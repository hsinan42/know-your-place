namespace Finance;

public record Expense(string Id, DateOnly Date, string CategoryId, string Description, decimal Amount,
    string Method, string Necessity = "Zorunlu", string? CardId = null, string Note = "", string Subcategory = "", bool IsTransfer = false);
public record Income(string Id, DateOnly Date, string Type, string Description, decimal Amount, bool IsBorrowing = false, bool IsSalary = false, bool IsTransfer = false);
