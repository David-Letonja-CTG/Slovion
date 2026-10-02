using Slovion.Application.Content;
using Slovion.Domain.Content;
using Slovion.Domain.Discovery;

namespace Slovion.Application.Discovery;

/// <summary>A save's NatureDex: observed species stay anonymous until identified.</summary>
public sealed class NatureDexService(IContentCatalog content, IDiscoveryRepository discoveries)
{
    /// <summary>Observed species of a slot, oldest observation first.</summary>
    public async Task<IReadOnlyList<NatureDexEntry>> GetAsync(
        Guid saveSlotId,
        string language,
        CancellationToken cancellationToken)
    {
        var stored = await discoveries.ListAsync(saveSlotId, cancellationToken);
        return stored
            .OrderBy(discovery => discovery.ObservedAt)
            .ThenBy(discovery => discovery.SpeciesId.Value, StringComparer.Ordinal)
            .Select(discovery => (discovery, species: content.FindSpecies(discovery.SpeciesId)))
            .Where(pair => pair.species is not null) // content removed since: skip, keep the record
            .Select(pair => ToEntry(pair.discovery, pair.species!, language))
            .ToList();
    }

    internal static NatureDexEntry ToEntry(SpeciesDiscovery discovery, Species species, string language) =>
        new(
            discovery.SpeciesId,
            species.Group,
            discovery.ObservedAt,
            discovery.IdentifiedAt,
            discovery.IsIdentified ? SpeciesView.For(species, language) : null);
}
