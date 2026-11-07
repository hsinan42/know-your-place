using System.Text.Json;

namespace Finance.Infrastructure.Persistence;

internal sealed class LedgerRow
{
    public Guid UserId { get; init; }
    public required string Json { get; init; }
    public int Version { get; init; } = 1;

    public static LedgerRow Empty(Guid userId, DateOnly today) => new()
    {
        UserId = userId,
        Json = JsonSerializer.Serialize(FinanceState.ForNewAccount(today), PostgresFinanceRepository.JsonOptions)
    };
}
