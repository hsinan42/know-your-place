using Finance.Api.Security;
using Finance.Application.Ledger;
using Finance.Application.Reports;

namespace Finance.Api.Ledger;

internal static class LedgerEndpoints
{
    public static void MapLedgerEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var api = endpoints.MapGroup("/api").RequireAuthorization().AddEndpointFilter<AccountContextFilter>();
        api.MapGet("/state", ReadAsync);
        api.MapGet("/workspace", ReadWorkspaceAsync);
        api.MapPut("/state", UpdateAsync);
        api.MapGet("/report/{year:int}/{month:int}", MonthlyAsync);
        api.MapGet("/card-outlook/{year:int}/{month:int}", CardOutlookAsync);
        api.MapGet("/lists/{collection}/{year:int}/{month:int}", ListEndpoints.ReadAsync);
    }

    private static async Task<IResult> ReadAsync(HttpContext http, IFinanceRepository repository, CancellationToken cancellationToken)
    {
        var snapshot = await repository.ReadAsync(UserId(http), cancellationToken);
        SetStateHeaders(http.Response, snapshot.Version);
        return Results.Ok(snapshot.State);
    }

    private static async Task<IResult> ReadWorkspaceAsync(HttpContext http, IFinanceRepository repository, CancellationToken cancellationToken)
    {
        var snapshot = await repository.ReadWorkspaceAsync(UserId(http), cancellationToken);
        SetStateHeaders(http.Response, snapshot.Version);
        return Results.Ok(snapshot.State);
    }

    private static async Task<IResult> UpdateAsync(FinanceState state, HttpContext http, UpdateLedger update,
        CancellationToken cancellationToken)
    {
        var revision = http.Request.Headers.IfMatch.ToString();
        var version = revision.Length >= 3 && revision[0] == '"' && revision[^1] == '"' &&
            int.TryParse(revision.AsSpan(1, revision.Length - 2), out var parsed) && revision == $"\"{parsed}\""
            ? parsed : (int?)null;
        var result = await update.ExecuteAsync(UserId(http), state, version, cancellationToken);
        if (result.IsConflict)
            return Results.Conflict(new { errors = new[] { "Veriler başka bir sekmede değişti. Sayfayı yenileyin; son değişikliğiniz kaydedilmedi." } });
        if (result.Version is not int nextVersion)
            return Results.BadRequest(new { errors = result.Errors });

        SetStateHeaders(http.Response, nextVersion);
        return Results.Ok();
    }

    private static async Task<IResult> MonthlyAsync(int year, int month, HttpContext http, FinanceReports reports,
        CancellationToken cancellationToken) => FinanceReports.IsValidPeriod(year, month)
        ? Results.Ok(await reports.MonthlyAsync(UserId(http), year, month, cancellationToken))
        : Results.BadRequest();

    private static async Task<IResult> CardOutlookAsync(int year, int month, HttpContext http, FinanceReports reports,
        CancellationToken cancellationToken) => FinanceReports.IsValidPeriod(year, month)
        ? Results.Ok(await reports.CardOutlookAsync(UserId(http), year, month, cancellationToken))
        : Results.BadRequest();

    private static Guid UserId(HttpContext http) => SessionIdentity.From(http).Account.Id;

    private static void SetStateHeaders(HttpResponse response, int version)
    {
        var revision = $"\"{version}\"";
        response.Headers.CacheControl = "no-store, no-transform";
        response.Headers.ETag = revision;
        response.Headers["X-Finance-Revision"] = revision;
    }
}
