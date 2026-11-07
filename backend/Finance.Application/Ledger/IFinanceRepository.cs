namespace Finance.Application.Ledger;

public record LedgerSnapshot(FinanceState State, int Version);

public interface IFinanceRepository
{
    Task<LedgerSnapshot> ReadAsync(Guid userId, CancellationToken cancellationToken);
    Task<LedgerSnapshot> ReadWorkspaceAsync(Guid userId, CancellationToken cancellationToken);
    Task<int?> TrySaveAsync(Guid userId, FinanceState state, int expectedVersion, CancellationToken cancellationToken);
}
