using Finance.Application.Accounts;
using Finance.Application.Ledger;
using Finance.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Finance.Infrastructure;

public static class InfrastructureServices
{
    public static void AddFinancePersistence(this IServiceCollection services, string connectionString)
    {
        services.AddDbContext<FinanceDbContext>(options => options.UseNpgsql(connectionString));
        services.AddScoped<IFinanceRepository, PostgresFinanceRepository>();
        services.AddScoped<ILedgerLists, PostgresLedgerLists>();
        services.AddScoped<IAccountStore, PostgresAccountStore>();
        services.AddSingleton<IPasswordHasher<string>, PasswordHasher<string>>();
        services.AddSingleton<PasswordTimingHash>();
        services.AddScoped(provider => new DatabaseInitializer(provider.GetRequiredService<FinanceDbContext>(),
            provider.GetRequiredService<IPasswordHasher<string>>(), provider.GetRequiredService<TimeProvider>()));
    }
}
