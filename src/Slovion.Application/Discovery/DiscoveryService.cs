using Slovion.Application.Content;
using Slovion.Domain.Discovery;

namespace Slovion.Application.Discovery;

public abstract record RecordDiscoveryResult
{
    private RecordDiscoveryResult()
    {
    }

    /// <summary>The map or spot does not exist, or holds no species.</summary>
    public sealed record UnknownSpot : RecordDiscoveryResult;

    public sealed record Recorded(NatureDexEntry Entry, bool IsNew) : RecordDiscoveryResult;
}

/// <summary>Discoveries are decided by the server from map content (docs/decisions.md D3).</summary>
public sealed class DiscoveryService(IContentCatalog content, IDiscoveryRepository discoveries, TimeProvider time)
{
    public async Task<RecordDiscoveryResult> RecordAsync(
        Guid saveSlotId,
        string mapId,
        string spotId,
        string language,
        CancellationToken cancellationToken)
    {
        var spot = content.FindSpot(mapId, spotId);
        var species = spot is null ? null : content.FindSpecies(spot.SpeciesId);
        if (spot is null || species is null)
        {
            return new RecordDiscoveryResult.UnknownSpot();
        }

        var (stored, added) = await discoveries.AddIfAbsentAsync(
            SpeciesDiscovery.Record(saveSlotId, spot, time.GetUtcNow()),
            cancellationToken);

        return new RecordDiscoveryResult.Recorded(
            new NatureDexEntry(stored.SpeciesId, stored.DiscoveredAt, SpeciesView.For(species, language)),
            added);
    }

    /// <summary>Discovered species of a slot, oldest discovery first.</summary>
    public async Task<IReadOnlyList<NatureDexEntry>> GetNatureDexAsync(
        Guid saveSlotId,
        string language,
        CancellationToken cancellationToken)
    {
        var stored = await discoveries.ListAsync(saveSlotId, cancellationToken);
        return stored
            .OrderBy(discovery => discovery.DiscoveredAt)
            .ThenBy(discovery => discovery.SpeciesId.Value, StringComparer.Ordinal)
            .Select(discovery => (discovery, species: content.FindSpecies(discovery.SpeciesId)))
            .Where(pair => pair.species is not null) // content removed since discovery: skip, keep the record
            .Select(pair => new NatureDexEntry(pair.discovery.SpeciesId, pair.discovery.DiscoveredAt, SpeciesView.For(pair.species!, language)))
            .ToList();
    }
}
