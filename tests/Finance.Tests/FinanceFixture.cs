using Finance;

internal static class FinanceFixture
{
    public static FinanceState Empty => new(new(8200, 900, new DateOnly(2026, 1, 1)),
        [
            new("food", "Yemek", 1200), new("market", "Market", 800), new("transport", "Ulaşım", 350),
            new("cafe", "Kafe", 450), new("bills", "Faturalar", 700), new("fun", "Eğlence", 250), new("other", "Diğer", 0)
        ],
        [], [], [], [], [], []);
}
