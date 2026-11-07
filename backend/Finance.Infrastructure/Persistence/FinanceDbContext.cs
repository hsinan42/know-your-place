using Microsoft.EntityFrameworkCore;

namespace Finance.Infrastructure.Persistence;

internal sealed class FinanceDbContext(DbContextOptions<FinanceDbContext> options) : DbContext(options)
{
    public DbSet<UserRow> Users => Set<UserRow>();
    public DbSet<LedgerRow> Ledgers => Set<LedgerRow>();
    public DbSet<SessionRow> Sessions => Set<SessionRow>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        model.Entity<UserRow>().HasIndex(user => user.NormalizedUsername).IsUnique();
        model.Entity<LedgerRow>().HasKey(ledger => ledger.UserId);
        model.Entity<LedgerRow>().Property(ledger => ledger.Version).IsConcurrencyToken();
        model.Entity<LedgerRow>().HasOne<UserRow>().WithOne().HasForeignKey<LedgerRow>(ledger => ledger.UserId);
        model.Entity<SessionRow>().HasOne(session => session.User).WithMany().HasForeignKey(session => session.UserId);
        model.Entity<SessionRow>().HasIndex(session => session.ExpiresAt);
    }
}
