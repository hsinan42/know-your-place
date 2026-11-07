using Finance.Application.Ledger;

namespace Finance.Application.Reports;

public record InstallmentReport(string Id, int Paid, int Remaining, decimal Debt, InstallmentDue? NextDue, int Total);
public record MonthlyReport(List<MonthReport> Months, AssetSummary Assets, List<Statement> Statements,
    PaymentAgenda UpcomingPayments, List<InstallmentReport> Installments);
public record StatementPeriod(int Year, int Month, List<Statement> Statements);

public sealed class FinanceReports(IFinanceRepository repository, TimeProvider clock)
{
    private DateOnly Today => FinanceDate.Today(clock);

    public static bool IsValidPeriod(int year, int month) => year is >= 2000 and <= 2100 && month is >= 1 and <= 12;

    public async Task<MonthlyReport> MonthlyAsync(Guid userId, int year, int month, CancellationToken cancellationToken)
    {
        var (state, _) = await repository.ReadAsync(userId, cancellationToken);
        var today = Today;
        var months = Calculator.Year(state, year, today);
        var cutoff = Calculator.AsOf(year, month, today);
        var installments = state.Installments.Select(plan =>
        {
            var progress = Calculator.Progress(state, plan, cutoff);
            return new InstallmentReport(plan.Id, progress.Paid, progress.Remaining, progress.Debt, progress.NextDue, plan.Count);
        }).ToList();

        return new(months, Calculator.Assets(state, year, month, today, months),
            Calculator.Statements(state, year, month, cutoff), Calculator.UpcomingPayments(state, today), installments);
    }

    public async Task<List<StatementPeriod>> CardOutlookAsync(Guid userId, int year, int month, CancellationToken cancellationToken)
    {
        var (state, _) = await repository.ReadAsync(userId, cancellationToken);
        var selected = new DateOnly(year, month, 1);
        var cutoff = Calculator.AsOf(year, month, Today);
        return Enumerable.Range(-4, 8).Select(offset =>
        {
            var period = selected.AddMonths(offset);
            return new StatementPeriod(period.Year, period.Month, Calculator.Statements(state, period.Year, period.Month, cutoff));
        }).ToList();
    }
}
