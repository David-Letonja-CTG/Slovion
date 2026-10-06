using Slovion.Domain.Content;
using Slovion.Domain.WorldGeneration;

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

    /// <summary>The seed of this save's natural world (D13): its generated maps depend on it. Never changes.</summary>
    public long WorldSeed { get; private set; }

    /// <summary>The generation version the save's world is made with. Never changes.</summary>
    public int WorldVersion { get; private set; }

    private SaveSlot(Guid id, byte[] tokenHash, DateTimeOffset createdAt, string regionId, long worldSeed, int worldVersion)
    {
        Id = id;
        TokenHash = tokenHash;
        CreatedAt = createdAt;
        RegionId = regionId;
        WorldSeed = worldSeed;
        WorldVersion = worldVersion;
    }

    /// <summary>A new save in the start region, with a world made from <paramref name="worldSeed"/> at the current generation version.</summary>
    public static SaveSlot Create(Guid id, byte[] tokenHash, DateTimeOffset createdAt, long worldSeed = 0)
    {
        ArgumentOutOfRangeException.ThrowIfEqual(id, Guid.Empty);
        ArgumentNullException.ThrowIfNull(tokenHash);
        ArgumentOutOfRangeException.ThrowIfZero(tokenHash.Length);
        return new SaveSlot(id, tokenHash, createdAt, Region.StartId, worldSeed, WorldGenerator.Version);
    }

    /// <summary>Makes <paramref name="regionId"/> the current region. Whether it may be entered is decided by the caller.</summary>
    public void TravelTo(string regionId)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(regionId);
        RegionId = regionId;
    }
}
