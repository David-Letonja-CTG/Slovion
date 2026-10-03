using Slovion.Application.Content;
using Slovion.Domain.Content;
using Slovion.Domain.Discovery;

namespace Slovion.Application.Discovery;

/// <summary>A save's NatureDex: every species per habitat; observed species stay anonymous until identified.</summary>
public sealed class NatureDexService(IContentCatalog content, IDiscoveryRepository discoveries)
{
    /// <summary>
    /// One section per habitat (by ID) listing all its species in content order. Discoveries of species no
    /// longer in content are skipped; their records are kept.
    /// </summary>
    public async Task<IReadOnlyList<NatureDexSection>> GetAsync(Guid saveSlotId, string language, CancellationToken cancellationToken)
    {
        var stored = (await discoveries.ListAsync(saveSlotId, cancellationToken)).ToDictionary(discovery => discovery.SpeciesId);
        return content.AllHabitats
            .Select(habitat => new NatureDexSection(
                habitat.Id,
                NameOf(habitat, language),
                habitat.Species
                    .Select(entry => (entry.SpeciesId, species: content.FindSpecies(entry.SpeciesId)))
                    .Where(pair => pair.species is not null)
                    .Select(pair => new NatureDexSlot(
                        pair.SpeciesId,
                        stored.TryGetValue(pair.SpeciesId, out var discovery) ? ToEntry(discovery, pair.species!, language) : null))
                    .ToList()))
            .ToList();
    }

    internal static NatureDexEntry ToEntry(SpeciesDiscovery discovery, Species species, string language) =>
        new(
            discovery.SpeciesId,
            species.Group,
            discovery.ObservedAt,
            discovery.IdentifiedAt,
            discovery.IsIdentified ? discovery.ResearchLevel : null,
            discovery.IsIdentified ? SpeciesView.For(species, language, discovery.ResearchLevel) : null);

    /// <summary>The habitat name in <paramref name="language"/>, falling back to Slovenian.</summary>
    private static string NameOf(Habitat habitat, string language) =>
        habitat.Names.TryGetValue(language, out var name) ? name : habitat.Names[IContentCatalog.DefaultLanguage];
}
