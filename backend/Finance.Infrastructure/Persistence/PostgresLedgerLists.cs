using System.Globalization;
using System.Text.Json;
using Finance.Application.Ledger;
using Finance.Application.Reports;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using NpgsqlTypes;

namespace Finance.Infrastructure.Persistence;

internal sealed class PostgresLedgerLists(FinanceDbContext db) : ILedgerLists
{
    public async Task<ListPage> ReadAsync(Guid userId, ListQuery query, DateOnly today, IReadOnlyList<ProjectedListRow>? projected,
        IReadOnlyList<InstallmentReport>? progress, CancellationToken cancellationToken)
    {
        var connection = (NpgsqlConnection)db.Database.GetDbConnection();
        await db.Database.OpenConnectionAsync(cancellationToken);
        try
        {
            var source = projected is not null ? Projected : query.Collection switch
            {
                "payment-history" => PaymentHistory,
                "payment-periods" => PaymentPeriods,
                "category-totals" => CategoryTotals,
                _ => Records
            };
            var sort = query.Sort switch
            {
                "name" => "name COLLATE finance_tr",
                "date" => "record_date",
                "kind" => "kind COLLATE finance_tr",
                "amount" => "amount",
                _ => "ordinal"
            };
            var order = sort + (query.Descending ? " DESC" : " ASC") + " NULLS LAST, ordinal, tie";
            await using var command = new NpgsqlCommand($"""
                WITH source AS ({source}),
                matching AS MATERIALIZED (
                    SELECT * FROM source
                    WHERE (@search = '' OR strpos(lower(search_text COLLATE finance_tr), lower(@search COLLATE finance_tr)) > 0)
                      AND (@kind IS NULL OR kind = @kind)
                      AND (@status IS NULL OR status = @status OR (@status = 'Devam ediyor' AND status = 'Geciken vade'))
                      AND (NOT @cardless OR card IS NULL)
                      AND (@card IS NULL OR card = @card)
                      AND (@category IS NULL OR category = @category)
                      AND (@method IS NULL OR method = @method)
                      AND (@date_prefix IS NULL OR starts_with(record_date, @date_prefix))
                ),
                stats AS (
                    SELECT count(*) AS total,
                        least(@page::bigint, greatest(1, (count(*) + @size - 1) / @size))::int AS page
                    FROM matching
                ),
                items AS (
                    SELECT * FROM matching ORDER BY {order}
                    LIMIT @size OFFSET (SELECT (page::bigint - 1) * @size FROM stats)
                )
                SELECT coalesce((SELECT jsonb_agg(payload ORDER BY {order}) FROM items), '[]'::jsonb)::text, total, page
                FROM stats
                """, connection);

            var period = new DateOnly(query.Year, query.Month, 1);
            Add("user_id", NpgsqlDbType.Uuid, userId);
            Add("collection", NpgsqlDbType.Text, query.Collection);
            Add("search", NpgsqlDbType.Text, query.Search);
            Add("kind", NpgsqlDbType.Text, query.Kind);
            Add("status", NpgsqlDbType.Text, query.Status);
            Add("cardless", NpgsqlDbType.Boolean, query.Card == "cash");
            Add("card", NpgsqlDbType.Text, query.Card switch
            {
                "cash" => null,
                { } value when value.StartsWith("card:", StringComparison.Ordinal) => value[5..],
                _ => query.Card
            });
            Add("category", NpgsqlDbType.Text, query.Category);
            Add("method", NpgsqlDbType.Text, query.Method);
            Add("date_prefix", NpgsqlDbType.Text, query.Period switch
            {
                "selected" => period.ToString("yyyy-MM", CultureInfo.InvariantCulture),
                "year" => period.ToString("yyyy", CultureInfo.InvariantCulture),
                _ => query.Period
            });
            Add("today", NpgsqlDbType.Text, today.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
            Add("cutoff", NpgsqlDbType.Text, Calculator.AsOf(query.Year, query.Month, today).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
            Add("page", NpgsqlDbType.Integer, query.Page);
            Add("size", NpgsqlDbType.Integer, query.PageSize);
            Add("projected", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(projected ?? [], PostgresFinanceRepository.JsonOptions));
            Add("progress", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(progress ?? [], PostgresFinanceRepository.JsonOptions));

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            await reader.ReadAsync(cancellationToken);
            using var document = JsonDocument.Parse(reader.GetString(0));
            return new(document.RootElement.Clone(), reader.GetInt64(1), reader.GetInt32(2));

            void Add(string name, NpgsqlDbType type, object? value) =>
                command.Parameters.AddWithValue(name, type, value ?? DBNull.Value);
        }
        finally
        {
            await db.Database.CloseConnectionAsync();
        }
    }

    private const string Projected = """
        SELECT items.ordinality AS ordinal, ''::text AS tie, p.payload, p.name,
            p.date AS record_date, p.amount, p.kind, p.status, p.card, NULL::text AS category,
            NULL::text AS method, p.name AS search_text
        FROM jsonb_array_elements(@projected) WITH ORDINALITY items(value, ordinality)
        CROSS JOIN LATERAL jsonb_to_record(items.value)
            AS p(payload jsonb, name text, date text, amount numeric, kind text, status text, card text)
        """;

    private const string Records = """
        SELECT e.ordinal, e.collection AS tie,
            CASE WHEN @collection = 'transactions'
                 THEN jsonb_build_object('row', e.payload, 'income', e.collection = 'incomes') ELSE e.payload END AS payload,
            coalesce(nullif(e.payload->>'description',''), e.payload->>'name', e.payload->>'type', 'Harcama') AS name,
            CASE WHEN plan.remaining = 0 THEN NULL ELSE coalesce(plan."nextDue"->>'date',
                e.payload->>'date', e.payload->>'start', e.payload->>'firstDate') END AS record_date,
            CASE WHEN plan.remaining = 0 THEN NULL ELSE coalesce(plan."nextDue"->>'amount',
                e.payload->>'amount', e.payload->>'monthlyLimit')::numeric END AS amount,
            CASE WHEN @collection = 'transactions' THEN CASE WHEN e.collection = 'incomes' THEN 'income' ELSE 'expense' END
                WHEN e.collection = 'expenses' THEN coalesce(category.payload->>'name', '—')
                WHEN e.collection = 'incomes' THEN CASE
                    WHEN e.payload->>'isTransfer' = 'true' THEN 'Hesaplar arası transfer'
                    WHEN e.payload->>'isBorrowing' = 'true' THEN 'Avans / kredi'
                    WHEN e.payload->>'isSalary' = 'true' OR lower(trim(e.payload->>'type') COLLATE finance_tr) IN ('maaş','maas') THEN 'Maaş'
                    ELSE 'Diğer gelir' END
                ELSE coalesce(nullif(e.payload->>'category',''), '—') END AS kind,
            CASE WHEN e.collection = 'subscriptions' THEN CASE
                WHEN e.payload->>'start' > @today THEN 'Planlanan'
                WHEN e.payload->>'end' < @today THEN 'Sona erdi' ELSE 'Aktif' END
                WHEN e.collection = 'installments' THEN CASE WHEN plan.remaining = 0 THEN 'Tamamlandı'
                WHEN plan."nextDue"->>'date' < @cutoff THEN 'Geciken vade' ELSE 'Devam ediyor' END END AS status,
            nullif(e.payload->>'cardId','') AS card, e.payload->>'categoryId' AS category, e.payload->>'method' AS method,
            concat_ws(' ', e.payload->>'description', e.payload->>'name', e.payload->>'type', e.payload->>'note',
                e.payload->>'subcategory', e.payload->>'category', e.payload->>'method', category.payload->>'name', card.payload->>'name') AS search_text
        FROM finance_entries e
        LEFT JOIN finance_entries category ON category.user_id = e.user_id AND category.collection = 'categories'
            AND category.payload->>'id' = e.payload->>'categoryId'
        LEFT JOIN finance_entries card ON card.user_id = e.user_id AND card.collection = 'cards'
            AND card.payload->>'id' = e.payload->>'cardId'
        LEFT JOIN jsonb_to_recordset(@progress) AS plan(id text, remaining int, "nextDue" jsonb)
            ON plan.id = e.payload->>'id' AND e.collection = 'installments'
        WHERE e.user_id = @user_id AND (e.collection = @collection OR
            (@collection = 'transactions' AND e.collection IN ('expenses','incomes')))
        """;

    private const string PaymentHistory = """
        SELECT e.ordinal, e.collection AS tie,
            jsonb_build_object('payment', e.payload, 'name', display.name, 'kind', display.kind) AS payload,
            display.name,
            coalesce(e.payload->>'paidOn', e.payload->>'closingDate') AS record_date,
            (e.payload->>'amount')::numeric AS amount, display.kind,
            CASE WHEN e.payload->>'paidOn' IS NULL OR e.payload->>'amount' IS NULL THEN 'missing' ELSE 'complete' END AS status,
            NULL::text AS card, NULL::text AS category, NULL::text AS method,
            concat_ws(' ', display.name, display.kind, e.payload->>'closingDate') AS search_text
        FROM finance_entries e
        LEFT JOIN finance_entries source ON source.user_id = e.user_id
            AND source.collection = CASE WHEN e.collection = 'payments' THEN 'cards'
                WHEN e.payload->>'kind' = 'Taksit' THEN 'installments' ELSE 'subscriptions' END
            AND source.payload->>'id' = coalesce(e.payload->>'cardId', e.payload->>'sourceId')
        CROSS JOIN LATERAL (
            SELECT coalesce(source.payload->>'name', e.payload->>'kind', 'Kart') AS name,
                   coalesce(e.payload->>'kind', 'Ekstre') AS kind
        ) display
        WHERE e.user_id = @user_id AND e.collection IN ('payments','cashPayments')
        """;

    private const string CategoryTotals = """
        SELECT 1 AS ordinal, ''::text AS tie, coalesce(jsonb_object_agg(category_id, total), '{}'::jsonb) AS payload,
            ''::text AS name, @date_prefix AS record_date, NULL::numeric AS amount,
            ''::text AS kind, NULL::text AS status, NULL::text AS card, NULL::text AS category,
            NULL::text AS method, ''::text AS search_text
        FROM (
            SELECT payload->>'categoryId' AS category_id, sum((payload->>'amount')::numeric) AS total
            FROM finance_entries
            WHERE user_id = @user_id AND collection = 'expenses'
              AND payload->>'categoryId' IS NOT NULL AND payload->>'isTransfer' IS DISTINCT FROM 'true'
              AND (@date_prefix IS NULL OR starts_with(payload->>'date', @date_prefix))
            GROUP BY payload->>'categoryId'
        ) grouped
        """;

    private const string PaymentPeriods = """
        SELECT 1 AS ordinal, ''::text AS tie, coalesce(jsonb_agg(DISTINCT period ORDER BY period DESC), '[]'::jsonb) AS payload,
            ''::text AS name, NULL::text AS record_date, NULL::numeric AS amount,
            ''::text AS kind, NULL::text AS status, NULL::text AS card, NULL::text AS category,
            NULL::text AS method, ''::text AS search_text
        FROM (
            SELECT left(coalesce(payload->>'paidOn', payload->>'closingDate'), 7) AS period
            FROM finance_entries
            WHERE user_id = @user_id AND collection IN ('payments', 'cashPayments')
        ) payments WHERE period IS NOT NULL
        """;
}
