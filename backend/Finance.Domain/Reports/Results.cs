namespace Finance;

public record Due(string SourceId, string Name, string Kind, DateOnly Date, decimal Amount, string? CardId, int Sequence = 0);
public record InstallmentDue(DateOnly Date, decimal Amount);
public record InstallmentProgress(int Paid, int Remaining, decimal Debt, InstallmentDue? NextDue = null);
public record MonthReport(int Month, decimal SalaryPlan, decimal EarnedIncome, decimal Borrowing, decimal Daily,
    decimal Subscriptions, decimal Installments, decimal Expense, decimal Net, decimal ForecastExpense, decimal ForecastNet,
    decimal SavingsTarget, decimal Budget, decimal BudgetRemaining, decimal? SavingsRate, bool Tracked,
    decimal SalaryReceived = 0, decimal OpeningBalance = 0, decimal ClosingBalance = 0,
    decimal CashIncome = 0, decimal CashOutflow = 0, decimal PlanOpeningBalance = 0, decimal PlanClosingBalance = 0);
public record Statement(string CardId, string Name, DateOnly ClosingDate, DateOnly DueDate, decimal Total, bool Paid, List<Due> Items);
public record StatementPayment(string CardId, string Name, DateOnly ClosingDate, DateOnly DueDate, decimal Total);
public record PaymentAgenda(DateOnly AsOf, DateOnly Through, List<StatementPayment> Statements, List<Due> CashDues);
public record AssetSummary(DateOnly AsOf, decimal Balance, decimal CardDebt, decimal YearEndPlan,
    bool HasEstimatedPayments, List<Due> UnpaidCashDues);
