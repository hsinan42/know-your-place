using Finance.Api.Security;
using Finance.Application.Ledger;
using Finance.Application.Reports;

namespace Finance.Api.Ledger;

internal static class ListEndpoints
{
    public static async Task<IResult> ReadAsync(string collection, int year, int month, HttpContext http,
        LedgerLists lists, CancellationToken cancellationToken)
    {
        if (!LedgerLists.IsCollection(collection) || !FinanceReports.IsValidPeriod(year, month))
            return Results.BadRequest();

        var query = http.Request.Query;
        string? Get(string key) => query.TryGetValue(key, out var value) && value.Count == 1 ? value[0] : null;
        var page = Get("page") is { } pageValue ? int.TryParse(pageValue, out var parsedPage) ? parsedPage : 0 : 1;
        var size = Get("size") is { } sizeValue ? int.TryParse(sizeValue, out var parsedSize) ? parsedSize : 0 : 10;
        var sort = Get("sort") ?? "position";
        var search = Get("search")?.Trim() ?? "";
        if (page < 1 || size is not (5 or 6 or 8 or 10 or 25 or 50 or 100) || search.Length > 250 ||
            sort is not ("position" or "name" or "date" or "kind" or "amount"))
            return Results.BadRequest();

        var input = new ListQuery(collection, year, month, search, sort, Get("direction") == "descending",
            page, size, Get("period"), Get("kind"), Get("status"), Get("card"), Get("category"), Get("method"));
        var result = await lists.ReadAsync(SessionIdentity.From(http).Account.Id, input, cancellationToken);
        return Results.Ok(result);
    }
}
