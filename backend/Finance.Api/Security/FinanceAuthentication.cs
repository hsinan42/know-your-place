using Finance.Application.Accounts;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;

namespace Finance.Api.Security;

internal static class FinanceAuthentication
{
    public static void AddFinanceAuthentication(this IServiceCollection services, string dataDirectory, bool allowHttp)
    {
        var tokens = new SessionTokens(SessionTokens.LoadSigningKey(dataDirectory));
        services.AddSingleton(tokens);
        services.AddSingleton(new SessionCookie(allowHttp));
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(options =>
        {
            options.MapInboundClaims = false;
            options.IncludeErrorDetails = false;
            options.TokenValidationParameters = tokens.ValidationParameters;
            options.Events = new JwtBearerEvents
            {
                OnMessageReceived = context =>
                {
                    if (context.Request.Cookies.TryGetValue(SessionCookie.Name, out var token))
                        context.Token = token;
                    else
                        context.NoResult();
                    return Task.CompletedTask;
                },
                OnTokenValidated = ValidateSessionAsync
            };
        });

        services.AddAuthorization();
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.AddFixedWindowLimiter("login", limiter =>
            {
                limiter.PermitLimit = 10;
                limiter.Window = TimeSpan.FromMinutes(1);
                limiter.QueueLimit = 0;
            });
            options.AddFixedWindowLimiter("register", limiter =>
            {
                limiter.PermitLimit = 5;
                limiter.Window = TimeSpan.FromMinutes(1);
                limiter.QueueLimit = 0;
            });
            options.AddFixedWindowLimiter("profile", limiter =>
            {
                limiter.PermitLimit = 10;
                limiter.Window = TimeSpan.FromMinutes(1);
                limiter.QueueLimit = 0;
            });
        });
    }

    private static async Task ValidateSessionAsync(TokenValidatedContext context)
    {
        if (!SessionIdentity.TryReadClaims(context.Principal, out var accountId, out var sessionId) ||
            !Guid.TryParse(context.Principal?.FindFirst(SessionTokens.CredentialClaim)?.Value, out var epoch))
        {
            context.Fail("Invalid session.");
            return;
        }

        var http = context.HttpContext;
        var store = http.RequestServices.GetRequiredService<IAccountStore>();
        var clock = http.RequestServices.GetRequiredService<TimeProvider>();
        var account = await store.FindSessionAccountAsync(accountId, sessionId, clock.GetUtcNow(), http.RequestAborted);
        if (account is null || account.CredentialEpoch != epoch)
        {
            context.Fail("Invalid session.");
            return;
        }

        new SessionIdentity(sessionId, account).Attach(http);
    }
}
