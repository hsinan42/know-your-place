using Finance.Application;
using Finance.Application.Accounts;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Finance.Infrastructure.Persistence;

public sealed class DatabaseInitializer
{
    private readonly FinanceDbContext db;
    private readonly IPasswordHasher<string> hasher;
    private readonly TimeProvider clock;

    internal DatabaseInitializer(FinanceDbContext db, IPasswordHasher<string> hasher, TimeProvider clock)
    {
        this.db = db;
        this.hasher = hasher;
        this.clock = clock;
    }

    public async Task InitializeAsync(string password, string? sqliteImportPath, bool verifyImport, CancellationToken cancellationToken)
    {
        const string normalizedOwner = "OWNER";
        var hash = hasher.HashPassword(normalizedOwner, password);
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(8728165102071541);", cancellationToken);
        await db.Database.ExecuteSqlRawAsync(PostgresSchema.Initialize, cancellationToken);
        var hasAccounts = await db.Users.AnyAsync(cancellationToken);
        if (!string.IsNullOrWhiteSpace(sqliteImportPath) && (!hasAccounts || verifyImport))
        {
            SQLitePCL.Batteries_V2.Init();
            await SqliteLedgerImport.ImportAsync(db, sqliteImportPath, hash, hasAccounts, cancellationToken);
        }
        var owner = await db.Users.SingleOrDefaultAsync(user => user.IsOwner, cancellationToken);
        if (owner is null)
        {
            owner = new UserRow
            {
                Id = Guid.NewGuid(),
                Username = AccountService.OwnerUsername,
                NormalizedUsername = normalizedOwner,
                PasswordHash = hash,
                IsOwner = true
            };
            db.Users.Add(owner);
            db.Ledgers.Add(LedgerRow.Empty(owner.Id, FinanceDate.Today(clock)));
        }
        else if (hasher.VerifyHashedPassword(normalizedOwner, owner.BootstrapPasswordHash ?? owner.PasswordHash, password)
                 == PasswordVerificationResult.Failed)
        {
            owner.PasswordHash = hash;
            owner.BootstrapPasswordHash = hash;
            owner.CredentialEpoch = Guid.NewGuid();
            await db.Sessions.Where(session => session.UserId == owner.Id).ExecuteDeleteAsync(cancellationToken);
        }

        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }
}
