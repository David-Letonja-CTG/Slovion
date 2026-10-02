using Slovion.Application.Content;
using Slovion.Application.Discovery;
using Slovion.Domain.Content;
using Slovion.Domain.Discovery;

namespace Slovion.Application.Tests.Discovery;

internal sealed class InMemoryDiscoveryRepository : IDiscoveryRepository
{
    private readonly List<SpeciesDiscovery> stored = [];

    public Task<(SpeciesDiscovery Stored, bool Added)> AddIfAbsentAsync(SpeciesDiscovery discovery, CancellationToken cancellationToken)
    {
        var existing = Find(discovery.SaveSlotId, discovery.SpeciesId);
        if (existing is not null)
        {
            return Task.FromResult((existing, false));
        }

        stored.Add(discovery);
        return Task.FromResult((discovery, true));
    }

    public Task<SpeciesDiscovery?> FindAsync(Guid saveSlotId, SpeciesId speciesId, CancellationToken cancellationToken) =>
        Task.FromResult(Find(saveSlotId, speciesId));

    public Task<SpeciesDiscovery> IdentifyAsync(Guid saveSlotId, SpeciesId speciesId, DateTimeOffset identifiedAt, CancellationToken cancellationToken)
    {
        var discovery = Find(saveSlotId, speciesId) ?? throw new InvalidOperationException("Not observed.");
        discovery.Identify(identifiedAt);
        return Task.FromResult(discovery);
    }

    public Task<IReadOnlyList<SpeciesDiscovery>> ListAsync(Guid saveSlotId, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<SpeciesDiscovery>>(stored.Where(d => d.SaveSlotId == saveSlotId).ToList());

    private SpeciesDiscovery? Find(Guid saveSlotId, SpeciesId speciesId) =>
        stored.SingleOrDefault(d => d.SaveSlotId == saveSlotId && d.SpeciesId == speciesId);
}

internal sealed class InMemoryEncounterRepository : IEncounterRepository
{
    private readonly Dictionary<Guid, (Encounter Encounter, bool Open)> stored = [];

    public Task StartAsync(Encounter encounter, CancellationToken cancellationToken)
    {
        foreach (var (id, entry) in stored.Where(e => e.Value.Encounter.SaveSlotId == encounter.SaveSlotId).ToList())
        {
            stored[id] = (entry.Encounter, false);
        }

        stored[encounter.Id] = (encounter, true);
        return Task.CompletedTask;
    }

    public Task<Encounter?> FindOpenAsync(Guid encounterId, Guid saveSlotId, CancellationToken cancellationToken) =>
        Task.FromResult(
            stored.TryGetValue(encounterId, out var entry) && entry.Open && entry.Encounter.SaveSlotId == saveSlotId
                ? entry.Encounter
                : null);

    public Task<bool> CloseAsync(Guid encounterId, Guid saveSlotId, DateTimeOffset closedAt, CancellationToken cancellationToken)
    {
        if (!stored.TryGetValue(encounterId, out var entry) || !entry.Open || entry.Encounter.SaveSlotId != saveSlotId)
        {
            return Task.FromResult(false);
        }

        stored[encounterId] = (entry.Encounter, false);
        return Task.FromResult(true);
    }
}

/// <summary>Deterministic randomness for tests.</summary>
internal sealed class SeededRandom(int seed) : IRandomSource
{
    private readonly Random random = new(seed);

    public int NextIndex(int maxExclusive) => random.Next(maxExclusive);
}

internal sealed class FakeContentCatalog(params Species[] species) : IContentCatalog
{
    public const string MapId = "test_meadow";

    public IReadOnlySet<string> Languages { get; } = new HashSet<string> { "sl", "en" };

    public IReadOnlyCollection<Species> AllSpecies => species;

    /// <summary>The habitat covering every tile with x ≥ 10 of <see cref="MapId"/>; none by default.</summary>
    public Habitat? Grass { get; set; }

    /// <summary>The habitats listed by <see cref="AllHabitats"/> (in ID order); empty by default.</summary>
    public List<Habitat> Habitats { get; } = [];

    public IReadOnlyList<Habitat> AllHabitats => Habitats.OrderBy(habitat => habitat.Id, StringComparer.Ordinal).ToList();

    public Species? FindSpecies(SpeciesId id) => species.FirstOrDefault(s => s.Id == id);

    public Habitat? FindHabitatAt(string mapId, int x, int y) => mapId == MapId && x >= 10 ? Grass : null;

    /// <summary>Every species has a spot named after it on <see cref="MapId"/>.</summary>
    public MapSpot? FindSpot(string mapId, string spotId) =>
        mapId == MapId && species.FirstOrDefault(s => s.Id.Value == spotId) is { } match
            ? new MapSpot(mapId, spotId, match.Id)
            : null;

    /// <summary>A habitat with a Slovenian name (and an English one when given) listing <paramref name="species"/> with weight 1.</summary>
    public static Habitat Habitat(string id, string slName, string? enName, params SpeciesId[] species)
    {
        var names = new Dictionary<string, string> { ["sl"] = slName };
        if (enName is not null)
        {
            names["en"] = enName;
        }

        return new Habitat(id, names, 100, species.Select(speciesId => new HabitatSpecies(speciesId, 1)).ToList());
    }

    /// <summary>A species whose characteristics are "{slName} trait 0..3" and whose clues are 3, 0, 1.</summary>
    public static Species Species(string id, string slName, string? enName = null, SpeciesGroup group = SpeciesGroup.Plant)
    {
        static Fact F(string value) => new(value, ["src"]);
        static SpeciesText Text(string name) => new(
            F(name), F("family"), F("habitat"), F("distribution"), F("season"),
            [F($"{name} trait 0"), F($"{name} trait 1"), F($"{name} trait 2"), F($"{name} trait 3")]);

        var text = new Dictionary<string, SpeciesText> { ["sl"] = Text(slName) };
        if (enName is not null)
        {
            text["en"] = Text(enName);
        }

        return new Species(
            SpeciesId.Parse(id),
            group,
            F(id),
            new Dictionary<string, Source>
            {
                ["src"] = new("src", "Title", "Publisher", new Uri("https://example.org"), new DateOnly(2026, 10, 2), "CC BY 4.0"),
                ["unused"] = new("unused", "Unused", "Nobody", new Uri("https://example.org/unused"), new DateOnly(2026, 10, 2), "CC BY 4.0"),
            },
            text,
            [3, 0, 1]);
    }
}
