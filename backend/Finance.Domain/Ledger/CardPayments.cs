namespace Finance;

public record StatementDates(DateOnly ClosingDate, DateOnly DueDate);
public record Card(string Id, string Name, int ClosingDay, int DueDays = 10, List<StatementDates>? StatementDates = null);

// A payment is a full-statement confirmation, not another expense. Date is optional for legacy data.
public record Payment(string Id, string CardId, DateOnly ClosingDate, DateOnly? PaidOn = null, decimal? Amount = null);
public record CashPayment(string Id, string Kind, string SourceId, DateOnly DueDate, DateOnly PaidOn, decimal Amount);
