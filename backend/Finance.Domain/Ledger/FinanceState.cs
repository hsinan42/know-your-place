namespace Finance;

public record FinanceState(
    Settings Settings,
    List<Category> Categories,
    List<Card> Cards,
    List<Expense> Expenses,
    List<Income> Incomes,
    List<Subscription> Subscriptions,
    List<Installment> Installments,
    List<Payment> Payments,
    List<SalaryPeriod>? SalaryPeriods = null,
    List<CashPayment>? CashPayments = null)
{
    public static FinanceState ForNewAccount(DateOnly today) => new(
        new(0, 0, new DateOnly(today.Year, today.Month, 1)),
        [
            new("food", "Yemek", 0),
            new("market", "Market", 0),
            new("transport", "Ulaşım", 0),
            new("cafe", "Kafe", 0),
            new("bills", "Faturalar", 0),
            new("fun", "Eğlence", 0),
            new("other", "Diğer", 0)
        ],
        [], [], [], [], [], [], [], []);
}
