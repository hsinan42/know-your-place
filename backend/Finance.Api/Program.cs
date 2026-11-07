using Finance.Api.Accounts;
using Finance.Api.Ledger;
using Finance.Api.Security;
using Finance.Application.Accounts;
using Finance.Application.Ledger;
using Finance.Application.Reports;
using Finance.Infrastructure;
using Finance.Infrastructure.Persistence;

var migrateOnly = args.Contains("--migrate-only", StringComparer.Ordinal);
var builder = WebApplication.CreateBuilder(args.Where(argument => argument != "--migrate-only").ToArray());
var configuration = builder.Configuration;
var password = configuration["ADMIN_PASSWORD"] ?? throw new InvalidOperationException("ADMIN_PASSWORD gerekli.");
var minimumPasswordLength = Math.Max(8, configuration.GetValue("ADMIN_PASSWORD_MIN_LENGTH", 12));
if (password.Length < minimumPasswordLength || password.Length > AccountService.MaximumPasswordLength)
    throw new InvalidOperationException($"ADMIN_PASSWORD {minimumPasswordLength}–{AccountService.MaximumPasswordLength} karakter olmalı.");

var dataDirectory = Path.GetFullPath(configuration["DATA_DIR"] ?? "data");
Directory.CreateDirectory(dataDirectory);
builder.Services.AddSingleton(TimeProvider.System);
var connectionString = configuration.GetConnectionString("Finance")
    ?? throw new InvalidOperationException("ConnectionStrings__Finance gerekli.");
builder.Services.AddFinancePersistence(connectionString);
builder.Services.AddScoped<AccountService>();
builder.Services.AddScoped<UpdateLedger>();
builder.Services.AddScoped<LedgerLists>();
builder.Services.AddScoped<FinanceReports>();
builder.Services.AddFinanceAuthentication(dataDirectory,
    builder.Environment.IsDevelopment() || configuration.GetValue<bool>("ALLOW_HTTP"));
builder.Services.AddProblemDetails();

var app = builder.Build();
await using (var scope = app.Services.CreateAsyncScope())
{
    var database = scope.ServiceProvider.GetRequiredService<DatabaseInitializer>();
    await database.InitializeAsync(password, configuration["SQLITE_IMPORT_PATH"], migrateOnly, app.Lifetime.ApplicationStopping);
}

if (migrateOnly)
{
    app.Logger.LogInformation("PostgreSQL şeması ve yapılandırılmış SQLite kaynağı doğrulandı.");
    return;
}

app.UseExceptionHandler();
app.UseMiddleware<RequestProtection>();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapAccountEndpoints();
app.MapLedgerEndpoints();
await app.RunAsync();
