using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using Finance.Application.Accounts;
using Microsoft.IdentityModel.Tokens;

namespace Finance.Api.Security;

internal sealed class SessionTokens(SymmetricSecurityKey signingKey)
{
    private const string Issuer = "GiderHesap";
    private const string Audience = "GiderHesap.Session";
    public const string CredentialClaim = "credential_epoch";

    public TokenValidationParameters ValidationParameters => new()
    {
        ValidIssuer = Issuer,
        ValidAudience = Audience,
        IssuerSigningKey = signingKey,
        ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
        ValidateIssuerSigningKey = true,
        ValidateLifetime = true,
        ClockSkew = TimeSpan.Zero
    };

    public string Issue(AccountSession session)
    {
        var token = new JwtSecurityToken(Issuer, Audience,
            [
                new Claim(JwtRegisteredClaimNames.Sub, session.Account.Id.ToString("D")),
                new Claim(JwtRegisteredClaimNames.Jti, session.Id.ToString("D")),
                new Claim(CredentialClaim, session.Account.CredentialEpoch.ToString("D"))
            ],
            notBefore: session.IssuedAt.UtcDateTime,
            expires: session.ExpiresAt.UtcDateTime,
            signingCredentials: new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public static SymmetricSecurityKey LoadSigningKey(string dataDirectory)
    {
        var path = Path.Combine(dataDirectory, "session-signing.key");
        if (!File.Exists(path))
        {
            var temporary = path + "." + Guid.NewGuid().ToString("N");
            try
            {
                var options = new FileStreamOptions { Mode = FileMode.CreateNew, Access = FileAccess.Write };
                if (!OperatingSystem.IsWindows())
                    options.UnixCreateMode = UnixFileMode.UserRead | UnixFileMode.UserWrite;
                using (var stream = new FileStream(temporary, options))
                    stream.Write(RandomNumberGenerator.GetBytes(32));
                File.Move(temporary, path);
            }
            catch (IOException) when (File.Exists(path))
            {
                // A simultaneous startup may have installed the key first.
            }
            finally
            {
                File.Delete(temporary);
            }
        }

        var key = File.ReadAllBytes(path);
        if (key.Length != 32) throw new InvalidOperationException("Oturum imzalama anahtarı geçersiz.");
        return new SymmetricSecurityKey(key);
    }
}
