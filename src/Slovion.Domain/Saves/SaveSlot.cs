using Slovion.Domain.Content;

namespace Slovion.Domain.Saves;

/// <summary>
/// An anonymous save. It is identified to players only by a secret token; the server keeps just the
/// token's hash (docs/decisions.md D4, D5). Holds no personal data.
/// </summary>
public sealed class SaveSlot
{
    public Guid Id { get; private set; }

    public byte[] TokenHash { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    /// <summary>The region the player is in; the game continues there.</summary>
    public string RegionId { get; private set; }

    private SaveSlot(Guid id, byte[] tokenHash, DateTimeOffset createdAt, string regionId)
    {
        Id = id;
        TokenHash = tokenHash;
        CreatedAt = createdAt;
        RegionId = regionId;
    }

    public static SaveSlot Create(Guid id, byte[] tokenHash, DateTimeOffset createdAt)
    {
        ArgumentOutOfRangeException.ThrowIfEqual(id, Guid.Empty);
        ArgumentNullException.ThrowIfNull(tokenHash);
        ArgumentOutOfRangeException.ThrowIfZero(tokenHash.Length);
        return new SaveSlot(id, tokenHash, createdAt, Region.StartId);
    }

    /// <summary>Makes <paramref name="regionId"/> the current region. Whether it may be entered is decided by the caller.</summary>
    public void TravelTo(string regionId)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(regionId);
        RegionId = regionId;
    }
}
