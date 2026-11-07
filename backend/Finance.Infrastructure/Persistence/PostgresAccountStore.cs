using Finance.Application;
using Finance.Application.Accounts;
using Microsoft.AspNetCore.Identity;
using Npgsql;
using Microsoft.EntityFrameworkCore;

namespace Finance.Infrastructure.Persistence;

internal sealed class PostgresAccountStore(
    FinanceDbContext db, IPasswordHasher<string> hasher, PasswordTimingHash timingHash, TimeProvider clock) : IAccountStore
{
    public async Task<Account?> AuthenticateAsync(string normalizedUsername, string password, CancellationToken cancellationToken)
    {
        var user = await db.Users.AsNoTracking()
            .SingleOrDefaultAsync(item => item.NormalizedUsername == normalizedUsername, cancellationToken);
        var result = hasher.VerifyHashedPassword(normalizedUsername, user?.PasswordHash ?? timingHash.Value, password);
        return result == PasswordVerificationResult.Failed ? null : user?.ToAccount();
    }

    public async Task<Account?> CreateAsync(string username, string normalizedUsername, string password, CancellationToken cancellationToken)
    {
        var user = new UserRow
        {
            Id = Guid.NewGuid(),
            Username = username,
            NormalizedUsername = normalizedUsername,
            PasswordHash = hasher.HashPassword(normalizedUsername, password),
            TourStarted = false
        };
        db.Users.Add(user);
        db.Ledgers.Add(LedgerRow.Empty(user.Id, FinanceDate.Today(clock)));
        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return user.ToAccount();
        }
        catch (DbUpdateException exception) when (exception.InnerException is PostgresException
            { SqlState: PostgresErrorCodes.UniqueViolation, ConstraintName: "Users_NormalizedUsername_key" })
        {
            return null;
        }
    }

    public async Task<ProfileChange> UpdateProfileAsync(Guid userId, Guid epoch, string username, string normalizedUsername,
        string currentPassword, string? newPassword, CancellationToken cancellationToken)
    {
        var user = await db.Users.AsNoTracking().SingleAsync(item => item.Id == userId, cancellationToken);
        if (user.CredentialEpoch != epoch) return ProfileChange.Conflict;
        if (hasher.VerifyHashedPassword(user.NormalizedUsername, user.PasswordHash, currentPassword) == PasswordVerificationResult.Failed)
            return ProfileChange.InvalidPassword;

        var nextHash = newPassword is null ? user.PasswordHash : hasher.HashPassword(normalizedUsername, newPassword);
        var bootstrapHash = user.IsOwner ? user.BootstrapPasswordHash ?? user.PasswordHash : null;
        var nextEpoch = Guid.NewGuid();
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var changed = await db.Users.Where(item => item.Id == userId && item.CredentialEpoch == user.CredentialEpoch)
                .ExecuteUpdateAsync(update => update
                    .SetProperty(item => item.Username, username)
                    .SetProperty(item => item.NormalizedUsername, normalizedUsername)
                    .SetProperty(item => item.PasswordHash, nextHash)
                    .SetProperty(item => item.BootstrapPasswordHash, bootstrapHash)
                    .SetProperty(item => item.CredentialEpoch, nextEpoch), cancellationToken);
            if (changed != 1) return ProfileChange.Conflict;
            await db.Sessions.Where(session => session.UserId == userId).ExecuteDeleteAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return ProfileChange.Updated;
        }
        catch (PostgresException exception) when (exception is
            { SqlState: PostgresErrorCodes.UniqueViolation, ConstraintName: "Users_NormalizedUsername_key" })
        {
            return ProfileChange.UsernameTaken;
        }
    }

    public async Task<bool> StartTourAsync(Guid userId, CancellationToken cancellationToken) =>
        await db.Users.Where(user => user.Id == userId && !user.TourStarted)
            .ExecuteUpdateAsync(update => update.SetProperty(user => user.TourStarted, true), cancellationToken) == 1;

    public async Task SaveSessionAsync(AccountSession session, CancellationToken cancellationToken)
    {
        await db.Sessions.Where(item => item.ExpiresAt <= session.IssuedAt.ToUnixTimeSeconds())
            .ExecuteDeleteAsync(cancellationToken);
        db.Sessions.Add(new SessionRow
        {
            Id = session.Id,
            UserId = session.Account.Id,
            ExpiresAt = session.ExpiresAt.ToUnixTimeSeconds()
        });
        await db.SaveChangesAsync(cancellationToken);
    }

    public Task<Account?> FindSessionAccountAsync(Guid userId, Guid sessionId, DateTimeOffset now, CancellationToken cancellationToken) =>
        db.Sessions.Where(session => session.UserId == userId && session.Id == sessionId && session.ExpiresAt > now.ToUnixTimeSeconds())
            .Select(session => new Account(session.UserId, session.User.Username, session.User.IsOwner,
                !session.User.TourStarted, session.User.CredentialEpoch))
            .SingleOrDefaultAsync(cancellationToken);

    public Task RevokeSessionAsync(Guid userId, Guid sessionId, CancellationToken cancellationToken) =>
        db.Sessions.Where(session => session.UserId == userId && session.Id == sessionId)
            .ExecuteDeleteAsync(cancellationToken);
}
