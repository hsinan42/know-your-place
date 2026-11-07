using System.Text.Json;
using Finance.Application.Reports;

namespace Finance.Application.Ledger;

public record ListQuery(string Collection, int Year, int Month, string Search, string Sort, bool Descending,
    int Page, int PageSize, string? Period, string? Kind, string? Status, string? Card, string? Category, string? Method);

public record ListPage(JsonElement Items, long Total, int Page);
public record ProjectedListRow(object Payload, string Name, string? Date, decimal? Amount, string Kind, string? Status = null, string? Card = null);

public interface ILedgerLists
{
    Task<ListPage> ReadAsync(Guid userId, ListQuery query, DateOnly today, IReadOnlyList<ProjectedListRow>? projected,
        IReadOnlyList<InstallmentReport>? progress, CancellationToken cancellationToken);
}

public sealed class LedgerLists(IFinanceRepository finance, ILedgerLists lists, TimeProvider clock)
{
    private static readonly HashSet<string> Collections =
        ["expenses", "incomes", "subscriptions", "installments", "categories", "transactions", "upcoming", "cash-dues",
            "payment-history", "statements", "statement-items", "category-totals", "payment-periods"];

    public static bool IsCollection(string collection) => Collections.Contains(collection);

    public async Task<ListPage> ReadAsync(Guid userId, ListQuery query, CancellationToken cancellationToken)
    {
        var today = FinanceDate.Today(clock);
        IReadOnlyList<ProjectedListRow>? projected = null;
        IReadOnlyList<InstallmentReport>? progress = null;
        if (query.Collection is "installments" or "upcoming" or "cash-dues" or "statements" or "statement-items")
        {
            var (state, _) = await finance.ReadAsync(userId, cancellationToken);
            var cutoff = Calculator.AsOf(query.Year, query.Month, today);
            switch (query.Collection)
            {
                case "installments":
                    progress = state.Installments.Select(plan =>
                    {
                        var item = Calculator.Progress(state, plan, cutoff);
                        return new InstallmentReport(plan.Id, item.Paid, item.Remaining, item.Debt, item.NextDue, plan.Count);
                    }).ToArray();
                    break;
                case "upcoming":
                    var agenda = Calculator.UpcomingPayments(state, today);
                    projected = agenda.Statements.Select(item => new ProjectedListRow(
                        new { statement = item }, item.Name, Iso(item.DueDate), item.Total, "Kart ekstresi", DueStatus(item.DueDate, today)))
                        .Concat(agenda.CashDues.Select(item => new ProjectedListRow(
                            new { due = item }, item.Name, Iso(item.Date), item.Amount, item.Kind + " · Kartsız", DueStatus(item.Date, today))))
                        .ToArray();
                    break;
                case "cash-dues":
                    projected = Calculator.PendingCashDues(state, cutoff)
                        .Select(item => new ProjectedListRow(item, item.Name, Iso(item.Date), item.Amount, item.Kind)).ToArray();
                    break;
                case "statements":
                case "statement-items":
                    projected = ProjectStatements(state, query, cutoff, today);
                    break;
            }
        }

        return await lists.ReadAsync(userId, query, today, projected, progress, cancellationToken);
    }

    private static IReadOnlyList<ProjectedListRow> ProjectStatements(FinanceState state, ListQuery query, DateOnly cutoff, DateOnly today)
    {
        var statements = Calculator.Statements(state, query.Year, query.Month, cutoff);
        if (query.Collection == "statement-items")
            return statements.SelectMany(statement => statement.Items.Select(item => new ProjectedListRow(
                item, item.Name, Iso(item.Date), item.Amount, item.Kind, Card: statement.CardId))).ToArray();

        return statements.Select(statement =>
        {
            var payment = state.Payments.Find(item => item.CardId == statement.CardId && item.ClosingDate == statement.ClosingDate);
            var status = statement.Paid ? "Tamamı Ödendi" : payment is not null ? "İleri Tarihli Ödeme"
                : statement.Total == 0 ? "Hareket Yok" : statement.DueDate < today ? "Vadesi Geçti" : "Ödeme Bekliyor";
            return new ProjectedListRow(new { statement, payment, status }, statement.Name, Iso(statement.DueDate),
                statement.Total, "", status, statement.CardId);
        }).ToArray();
    }

    private static string Iso(DateOnly date) => date.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture);
    private static string DueStatus(DateOnly date, DateOnly today) => date < today ? "late" : "upcoming";
}
