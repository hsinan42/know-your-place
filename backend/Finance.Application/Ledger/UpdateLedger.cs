namespace Finance.Application.Ledger;

public record LedgerUpdate(int? Version, IReadOnlyList<string> Errors)
{
    public bool IsConflict => Version is null && Errors.Count == 0;
}

public sealed class UpdateLedger(IFinanceRepository repository)
{
    public async Task<LedgerUpdate> ExecuteAsync(
        Guid userId, FinanceState state, int? expectedVersion, CancellationToken cancellationToken)
    {
        var errors = Validation.Check(state);
        if (errors.Count > 0) return new(null, errors);

        var previous = await repository.ReadAsync(userId, cancellationToken);
        if (previous.Version != expectedVersion) return new(null, []);

        var historyError = ValidatePaymentHistory(previous.State, state);
        if (historyError is not null) return new(null, [historyError]);

        var nextVersion = await repository.TrySaveAsync(userId, state, previous.Version, cancellationToken);
        return new(nextVersion, []);
    }

    private static string? ValidatePaymentHistory(FinanceState previous, FinanceState next)
    {
        var previousPaymentIds = previous.Payments.Select(payment => payment.Id).ToHashSet();
        if (next.Payments.Any(payment =>
                !previousPaymentIds.Contains(payment.Id) && (payment.Amount is null || payment.PaidOn is null)))
            return "Yeni ekstre ödemesinde gerçek tarih ve tutar zorunludur.";

        var nextCards = next.Cards.ToDictionary(card => card.Id);
        var previousCards = previous.Cards.ToDictionary(card => card.Id);
        var nextPaymentIds = next.Payments.Select(payment => payment.Id).ToHashSet();
        foreach (var payment in previous.Payments)
        {
            if (!previousCards.TryGetValue(payment.CardId, out var oldCard) ||
                !nextCards.TryGetValue(payment.CardId, out var newCard))
                continue;

            if (newCard.ClosingDay != oldCard.ClosingDay || newCard.DueDays != oldCard.DueDays)
                return "Ödeme geçmişi olan kartın kesim/son ödeme kuralı değiştirilemez. Yeni dönem için ayrı kart tanımı açın.";

            if (!nextPaymentIds.Contains(payment.Id)) continue;

            var period = new DateOnly(payment.ClosingDate.Year, payment.ClosingDate.Month, 1);
            if (Calculator.StatementDate(period, oldCard) != Calculator.StatementDate(period, newCard))
                return "Ödeme kaydı olan dönemin ekstre kesim tarihi değiştirilemez.";
        }

        return null;
    }
}
