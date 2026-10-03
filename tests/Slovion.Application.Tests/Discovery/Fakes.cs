using Slovion.Application.Content;
using Slovion.Application.Discovery;
using Slovion.Domain.Content;
using Slovion.Domain.Discovery;
using Slovion.Domain.World;

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

    public Task<(SpeciesDiscovery Stored, bool Researched)> ResearchAsync(Guid saveSlotId, SpeciesId speciesId, DateTimeOffset at, DateTimeOffset saveCreatedAt, CancellationToken cancellationToken)
    {
        var discovery = Find(saveSlotId, speciesId) ?? throw new InvalidOperationException("Not observed.");
        return Task.FromResult((discovery, discovery.Research(at, saveCreatedAt)));
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

internal sealed class FakeContentCatalog(params Species[] initial) : IContentCatalog
{
    private readonly List<Species> species = [.. initial];

    public const string MapId = "test_meadow";

    public IReadOnlySet<string> Languages { get; } = new HashSet<string> { "sl", "en" };

    public IReadOnlyCollection<Species> AllSpecies => species;

    /// <summary>The habitat covering every tile with x ≥ 10 of <see cref="MapId"/>; none by default.</summary>
    public Habitat? Grass { get; set; }

    /// <summary>The habitats listed by <see cref="AllHabitats"/> (by order, then ID); empty by default.</summary>
    public List<Habitat> Habitats { get; } = [];

    /// <summary>NPCs standing on <see cref="MapId"/>; none by default.</summary>
    public List<Npc> Npcs { get; } = [];

    public List<Quest> Quests { get; } = [];

    /// <summary>The regions listed by <see cref="AllRegions"/> (by order, then ID); none by default.</summary>
    public List<Region> Regions { get; } = [];

    /// <summary>The tools listed by <see cref="AllItems"/>; none by default.</summary>
    public List<Item> Items { get; } = [];

    public IReadOnlyList<Item> AllItems => Items;

    public Item? FindItem(string itemId) => Items.FirstOrDefault(item => item.Id == itemId);

    public IReadOnlyList<Habitat> AllHabitats => Habitats.OrderBy(habitat => habitat.Order).ThenBy(habitat => habitat.Id, StringComparer.Ordinal).ToList();

    public IReadOnlyList<Region> AllRegions => Regions.OrderBy(region => region.Order).ThenBy(region => region.Id, StringComparer.Ordinal).ToList();

    public Species? FindSpecies(SpeciesId id) => species.FirstOrDefault(s => s.Id == id);

    /// <summary>Replaces the species with the same ID.</summary>
    public void Replace(Species replacement)
    {
        species.RemoveAll(s => s.Id == replacement.Id);
        species.Add(replacement);
    }

    public MapNpc? FindNpcOnMap(string mapId, string npcId) =>
        mapId == MapId && Npcs.FirstOrDefault(npc => npc.Id == npcId) is { } match ? new MapNpc(mapId, match) : null;

    public Quest? FindQuest(string questId) => Quests.FirstOrDefault(quest => quest.Id == questId);

    public Region? FindRegion(string regionId) => Regions.FirstOrDefault(region => region.Id == regionId);

    public Region? FindRegionOfMap(string mapId) => Regions.FirstOrDefault(region => region.MapId == mapId);

    public Quest? FindQuestByGiver(string npcId) => Quests.FirstOrDefault(quest => quest.GiverId == npcId);

    public Habitat? FindHabitatAt(string mapId, int x, int y) => mapId == MapId && x >= 10 ? Grass : null;

    public IReadOnlyList<MapSpot>? SpotsOn(string mapId) =>
        mapId == MapId ? species.Select(s => new MapSpot(mapId, s.Id.Value, s.Id)).ToList() : null;

    /// <summary>Every species has a spot named after it on <see cref="MapId"/>.</summary>
    public MapSpot? FindSpot(string mapId, string spotId) =>
        mapId == MapId && species.FirstOrDefault(s => s.Id.Value == spotId) is { } match
            ? new MapSpot(mapId, spotId, match.Id)
            : null;

    /// <summary>A habitat with an order, a Slovenian name (and an English one when given) listing <paramref name="species"/> with weight 1.</summary>
    public static Habitat Habitat(string id, int order, string slName, string? enName, params SpeciesId[] species)
    {
        var names = new Dictionary<string, string> { ["sl"] = slName };
        if (enName is not null)
        {
            names["en"] = enName;
        }

        return new Habitat(id, names, order, 100, species.Select(speciesId => new HabitatSpecies(speciesId, 1)).ToList());
    }

    /// <summary>
    /// A species whose characteristics are "{slName} trait 0..3" and whose clues are 3, 0, 1. It is available in
    /// <paramref name="seasons"/> (default: all) at every time of day.
    /// </summary>
    public static Species Species(string id, string slName, string? enName = null, SpeciesGroup group = SpeciesGroup.Plant, params Season[] seasons)
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
            [3, 0, 1],
            new Availability(
                (seasons.Length > 0 ? seasons : Enum.GetValues<Season>()).ToHashSet(),
                Enum.GetValues<TimeOfDay>().ToHashSet(),
                ["src"]),
            group == SpeciesGroup.Plant ? null : new WildlifeTraits(TorchReaction.Calm));
    }
}
