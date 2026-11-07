namespace Finance;

public record Subscription(string Id, string Name, string Category, decimal Amount, int PaymentDay,
    DateOnly Start, DateOnly? End = null, string? CardId = null, string Note = "");
public record Installment(string Id, string Name, string Category, decimal Amount, DateOnly FirstDate,
    int Count, int ManualPaid = 0, string? CardId = null, string Note = "",
    decimal? FirstAmount = null, decimal? LastAmount = null);
