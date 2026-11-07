using System.Text.Json;
using Finance.Application.Ledger;
using Microsoft.EntityFrameworkCore;

namespace Finance.Infrastructure.Persistence;

internal sealed class PostgresFinanceRepository(FinanceDbContext db) : IFinanceRepository
{
    internal static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<LedgerSnapshot> ReadAsync(Guid userId, CancellationToken cancellationToken)
    {
        var row = await db.Ledgers.AsNoTracking().SingleAsync(ledger => ledger.UserId == userId, cancellationToken);
        var state = JsonSerializer.Deserialize<FinanceState>(row.Json, JsonOptions)
            ?? throw new InvalidOperationException("Finans kayıtları okunamadı.");
        return new(state, row.Version);
    }

    public async Task<LedgerSnapshot> ReadWorkspaceAsync(Guid userId, CancellationToken cancellationToken)
    {
        var row = await db.Ledgers.FromSqlInterpolated($$"""
            SELECT "UserId", "Version", ("Json"::jsonb || jsonb_build_object(
                'expenses', '[]'::jsonb, 'incomes', '[]'::jsonb, 'installments', '[]'::jsonb, 'subscriptions', '[]'::jsonb))::text AS "Json"
            FROM "Ledgers" WHERE "UserId" = {{userId}}
            """).AsNoTracking().SingleAsync(cancellationToken);
        var state = JsonSerializer.Deserialize<FinanceState>(row.Json, JsonOptions)
            ?? throw new InvalidOperationException("Çalışma alanı okunamadı.");
        return new(state, row.Version);
    }

    public async Task<int?> TrySaveAsync(Guid userId, FinanceState state, int expectedVersion, CancellationToken cancellationToken)
    {
        var json = JsonSerializer.Serialize(state, JsonOptions);
        var nextVersion = checked(expectedVersion + 1);
        var updated = await db.Ledgers.Where(row => row.UserId == userId && row.Version == expectedVersion)
            .ExecuteUpdateAsync(setters => setters.SetProperty(row => row.Json, json)
                .SetProperty(row => row.Version, nextVersion), cancellationToken);
        return updated == 1 ? nextVersion : null;
    }
}
