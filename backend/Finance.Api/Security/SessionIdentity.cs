using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Finance.Application.Accounts;

namespace Finance.Api.Security;

internal sealed record SessionIdentity(Guid Id, Account Account)
{
    private static readonly object ItemKey = new();

    public static SessionIdentity From(HttpContext context) => (SessionIdentity)context.Items[ItemKey]!;

    public void Attach(HttpContext context) => context.Items[ItemKey] = this;

    public static bool TryReadClaims(ClaimsPrincipal? principal, out Guid accountId, out Guid sessionId)
    {
        var validAccount = Guid.TryParse(principal?.FindFirstValue(JwtRegisteredClaimNames.Sub), out accountId);
        var validSession = Guid.TryParse(principal?.FindFirstValue(JwtRegisteredClaimNames.Jti), out sessionId);
        return validAccount && validSession;
    }
}
