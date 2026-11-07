using System.Security.Cryptography;
using Microsoft.AspNetCore.Identity;

namespace Finance.Infrastructure.Persistence;

internal sealed class PasswordTimingHash(IPasswordHasher<string> hasher)
{
    public string Value { get; } = hasher.HashPassword(string.Empty, Convert.ToHexString(RandomNumberGenerator.GetBytes(32)));
}
