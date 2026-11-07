namespace Finance.Api.Security;

internal sealed class AccountContextFilter : IEndpointFilter
{
    public ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext invocation, EndpointFilterDelegate next)
    {
        var context = invocation.HttpContext;
        var account = SessionIdentity.From(context).Account;
        // The header confirms which account the browser rendered. Ownership comes from the verified session.
        if (context.Request.Headers["X-Finance-Account"] != account.Id.ToString("D"))
            return ValueTask.FromResult<object?>(Results.Unauthorized());

        return next(invocation);
    }
}
