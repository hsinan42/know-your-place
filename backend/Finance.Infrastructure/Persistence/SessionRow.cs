namespace Finance.Infrastructure.Persistence;

internal sealed class SessionRow
{
    public Guid Id { get; init; }
    public Guid UserId { get; init; }
    public UserRow User { get; init; } = null!;
    public long ExpiresAt { get; init; }
}
