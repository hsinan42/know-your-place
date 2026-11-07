namespace Finance.Application.Accounts;

public sealed class AccountService(IAccountStore store, TimeProvider clock)
{
    public const string OwnerUsername = "owner";
    public const int MinimumPasswordLength = 12;
    public const int MaximumPasswordLength = 256;
    public const int MaximumUsernameLength = 32;

    public static string? ValidateNewAccount(string username, string password)
        => ValidateUsername(username) ?? ValidatePassword(password);

    public static string? ValidateUsername(string username)
    {
        if (username.Length is < 3 or > MaximumUsernameLength ||
            !char.IsAsciiLetterOrDigit(username[0]) ||
            username.Any(character => !char.IsAsciiLetterOrDigit(character) && character is not ('.' or '_' or '-')))
            return "Kullanıcı adı 3–32 karakter olmalı. Harf veya rakamla başla; nokta, alt çizgi ve kısa çizgi kullanabilirsin.";

        return null;
    }

    public static string? ValidatePassword(string password) =>
        password.Length is < MinimumPasswordLength or > MaximumPasswordLength || string.IsNullOrWhiteSpace(password)
            ? "Şifre 12–256 karakter olmalı." : null;

    public Task<Account?> CreateAsync(string username, string password, CancellationToken cancellationToken) =>
        username.Equals(OwnerUsername, StringComparison.OrdinalIgnoreCase)
            ? Task.FromResult<Account?>(null)
            : store.CreateAsync(username, username.ToUpperInvariant(), password, cancellationToken);

    public Task<ProfileChange> UpdateProfileAsync(Account account, string username, string currentPassword,
        string? newPassword, CancellationToken cancellationToken) =>
        !account.IsOwner && username.Equals(OwnerUsername, StringComparison.OrdinalIgnoreCase)
            ? Task.FromResult(ProfileChange.UsernameTaken)
            : store.UpdateProfileAsync(account.Id, account.CredentialEpoch, username, username.ToUpperInvariant(),
                currentPassword, newPassword, cancellationToken);

    public async Task<AccountSession?> SignInAsync(
        string username, string password, CancellationToken cancellationToken)
    {
        if (username.Length is 0 or > MaximumUsernameLength || password.Length is 0 or > MaximumPasswordLength)
            return null;

        var account = await store.AuthenticateAsync(username.ToUpperInvariant(), password, cancellationToken);
        if (account is null) return null;

        var issuedAt = clock.GetUtcNow();
        var session = new AccountSession(Guid.NewGuid(), account, issuedAt, issuedAt.AddHours(12));
        await store.SaveSessionAsync(session, cancellationToken);
        return session;
    }
}
