namespace Finance.Api.Security;

internal sealed class RequestProtection(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context)
    {
        context.Response.Headers.CacheControl = "no-store";
        context.Response.Headers.XContentTypeOptions = "nosniff";

        // With CORS disabled, other origins cannot send this header on a browser request.
        var method = context.Request.Method;
        if (method is not ("GET" or "HEAD" or "OPTIONS") && context.Request.Headers["X-Finance-Request"] != "1")
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            return;
        }

        await next(context);
    }
}
