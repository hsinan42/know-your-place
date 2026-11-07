using System.Text.Json.Serialization;

namespace Finance.Application.Accounts;

public record Account(Guid Id, string Username, bool IsOwner, bool TourPending, [property: JsonIgnore] Guid CredentialEpoch);
public record AccountSession(Guid Id, Account Account, DateTimeOffset IssuedAt, DateTimeOffset ExpiresAt);
public enum ProfileChange { Updated, InvalidPassword, UsernameTaken, Conflict }

public interface IAccountStore
{
    Task<Account?> AuthenticateAsync(string normalizedUsername, string password, CancellationToken cancellationToken);
    Task<Account?> CreateAsync(string username, string normalizedUsername, string password, CancellationToken cancellationToken);
    Task<ProfileChange> UpdateProfileAsync(Guid userId, Guid epoch, string username, string normalizedUsername,
        string currentPassword, string? newPassword, CancellationToken cancellationToken);
    Task<bool> StartTourAsync(Guid userId, CancellationToken cancellationToken);
    Task SaveSessionAsync(AccountSession session, CancellationToken cancellationToken);
    Task<Account?> FindSessionAccountAsync(Guid userId, Guid sessionId, DateTimeOffset now, CancellationToken cancellationToken);
    Task RevokeSessionAsync(Guid userId, Guid sessionId, CancellationToken cancellationToken);
}
