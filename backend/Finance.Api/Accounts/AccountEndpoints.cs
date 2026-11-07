using Finance.Api.Security;
using Finance.Application.Accounts;

namespace Finance.Api.Accounts;

internal static class AccountEndpoints
{
    public static void MapAccountEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var api = endpoints.MapGroup("/api");
        api.MapPost("/login", LoginAsync).RequireRateLimiting("login");
        api.MapPost("/register", CreateAsync).RequireRateLimiting("register");
        api.MapGet("/session", (HttpContext http) => Results.Ok(SessionIdentity.From(http).Account))
            .RequireAuthorization();

        var authenticated = api.MapGroup("").RequireAuthorization().AddEndpointFilter<AccountContextFilter>();
        authenticated.MapPost("/logout", LogoutAsync);
        authenticated.MapPut("/profile", UpdateProfileAsync).RequireRateLimiting("profile");
        authenticated.MapPost("/tour/start", async (HttpContext http, IAccountStore store, CancellationToken token) =>
            Results.Ok(new { started = await store.StartTourAsync(SessionIdentity.From(http).Account.Id, token) }));
    }

    private static async Task<IResult> LoginAsync(LoginInput input, AccountService accounts, IAccountStore store,
        SessionTokens tokens, SessionCookie cookie, HttpContext http, CancellationToken cancellationToken)
    {
        var session = await accounts.SignInAsync(input.Username?.Trim() ?? "", input.Password ?? "", cancellationToken);
        if (session is null) return Results.Unauthorized();

        if (SessionIdentity.TryReadClaims(http.User, out var previousUser, out var previousSession))
            await store.RevokeSessionAsync(previousUser, previousSession, cancellationToken);

        cookie.Write(http, tokens.Issue(session));
        return Results.Ok(session.Account);
    }

    private static async Task<IResult> LogoutAsync(HttpContext http, IAccountStore store,
        SessionCookie cookie, CancellationToken cancellationToken)
    {
        var session = SessionIdentity.From(http);
        await store.RevokeSessionAsync(session.Account.Id, session.Id, cancellationToken);
        cookie.Clear(http);
        return Results.Ok();
    }

    private static async Task<IResult> CreateAsync(CreateAccountInput input, AccountService accounts,
        CancellationToken cancellationToken)
    {
        var username = input.Username?.Trim() ?? "";
        var password = input.Password ?? "";
        var error = AccountService.ValidateNewAccount(username, password);
        if (error is not null) return Results.BadRequest(new { errors = new[] { error } });

        var account = await accounts.CreateAsync(username, password, cancellationToken);
        return account is null
            ? Results.Conflict(new { errors = new[] { "Bu kullanıcı adı zaten kullanılıyor." } })
            : Results.Json(account, statusCode: StatusCodes.Status201Created);
    }

    private static async Task<IResult> UpdateProfileAsync(ProfileInput input, AccountService accounts,
        SessionCookie cookie, HttpContext http, CancellationToken cancellationToken)
    {
        var username = input.Username?.Trim() ?? "";
        var currentPassword = input.CurrentPassword ?? "";
        var newPassword = string.IsNullOrEmpty(input.NewPassword) ? null : input.NewPassword;
        var error = AccountService.ValidateUsername(username) ??
            (newPassword is null ? null : AccountService.ValidatePassword(newPassword));
        if (error is not null) return Results.BadRequest(new { errors = new[] { error } });
        if (currentPassword.Length is 0 or > AccountService.MaximumPasswordLength)
            return Results.BadRequest(new { errors = new[] { "Mevcut şifreni gir." } });

        var result = await accounts.UpdateProfileAsync(SessionIdentity.From(http).Account, username,
            currentPassword, newPassword, cancellationToken);
        switch (result)
        {
            case ProfileChange.InvalidPassword:
                return Results.BadRequest(new { errors = new[] { "Mevcut şifre hatalı." } });
            case ProfileChange.UsernameTaken:
                return Results.Conflict(new { errors = new[] { "Bu kullanıcı adı zaten kullanılıyor." } });
            case ProfileChange.Conflict:
                return Results.Conflict(new { errors = new[] { "Hesap bilgilerin değişti. Lütfen yeniden giriş yap." } });
            default:
                cookie.Clear(http);
                return Results.NoContent();
        }
    }

    private sealed record LoginInput(string? Username, string? Password);
    private sealed record CreateAccountInput(string? Username, string? Password);
    private sealed record ProfileInput(string? Username, string? CurrentPassword, string? NewPassword);
}
