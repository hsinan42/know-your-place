using Finance.Application.Accounts;

namespace Finance.Infrastructure.Persistence;

internal sealed class UserRow
{
    public Guid Id { get; init; }
    public required string Username { get; init; }
    public required string NormalizedUsername { get; init; }
    public required string PasswordHash { get; set; }
    public bool IsOwner { get; init; }
    public bool TourStarted { get; init; } = true;
    public Guid CredentialEpoch { get; set; }
    public string? BootstrapPasswordHash { get; set; }

    public Account ToAccount() => new(Id, Username, IsOwner, !TourStarted, CredentialEpoch);
}
