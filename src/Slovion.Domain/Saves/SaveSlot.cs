namespace Slovion.Domain.Saves;

/// <summary>
/// An anonymous save. It is identified to players only by a secret token; the server keeps just the
/// token's hash (docs/decisions.md D4, D5). Holds no personal data.
/// </summary>
public sealed class SaveSlot
{
    private SaveSlot(Guid id, byte[] tokenHash, DateTimeOffset createdAt)
    {
        Id = id;
        TokenHash = tokenHash;
        CreatedAt = createdAt;
    }

    public Guid Id { get; private set; }

    public byte[] TokenHash { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public static SaveSlot Create(Guid id, byte[] tokenHash, DateTimeOffset createdAt)
    {
        ArgumentOutOfRangeException.ThrowIfEqual(id, Guid.Empty);
        ArgumentNullException.ThrowIfNull(tokenHash);
        ArgumentOutOfRangeException.ThrowIfZero(tokenHash.Length);
        return new SaveSlot(id, tokenHash, createdAt);
    }
}
