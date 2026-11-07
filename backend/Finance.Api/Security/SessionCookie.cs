namespace Finance.Api.Security;

internal sealed class SessionCookie(bool allowHttp)
{
    public const string Name = "finance_access";
    private const string LegacyName = "finance_session";

    public void Write(HttpContext context, string jwt)
    {
        var options = Options(context);
        context.Response.Cookies.Append(Name, jwt, options);
        if (context.Request.Cookies.ContainsKey(LegacyName))
        {
            var legacyOptions = Options(context);
            legacyOptions.Path = "/";
            context.Response.Cookies.Delete(LegacyName, legacyOptions);
        }
    }

    public void Clear(HttpContext context) => context.Response.Cookies.Delete(Name, Options(context));

    private CookieOptions Options(HttpContext context) => new()
    {
        HttpOnly = true,
        Secure = !allowHttp || context.Request.IsHttps,
        SameSite = SameSiteMode.Strict,
        Path = "/api"
    };
}
