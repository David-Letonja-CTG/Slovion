using Slovion.Domain.Content;

namespace Slovion.Application.Content;

/// <summary>Validated, read-only game content (docs/decisions.md D7).</summary>
public interface IContentCatalog
{
    /// <summary>The language every content item must provide and the fallback for all others.</summary>
    public const string DefaultLanguage = "sl";

    /// <summary>Languages for which content text exists.</summary>
    IReadOnlySet<string> Languages { get; }

    /// <summary>Every species in the catalog.</summary>
    IReadOnlyCollection<Species> AllSpecies { get; }

    /// <summary>Every habitat in the catalog, ordered by their order, then by ID.</summary>
    IReadOnlyList<Habitat> AllHabitats { get; }

    /// <summary>Every region in the catalog, ordered by their order, then by ID.</summary>
    IReadOnlyList<Region> AllRegions { get; }

    /// <summary>Every field tool in content order.</summary>
    IReadOnlyList<Item> AllItems { get; }

    Item? FindItem(string itemId);

    /// <summary>Every research station, ordered by the order of its map's region, then by ID.</summary>
    IReadOnlyList<Station> AllStations { get; }

    Station? FindStation(string stationId);

    Species? FindSpecies(SpeciesId id);

    /// <summary>Whether a map (authored or a template) exists. Its layout for a save comes from <see cref="IWorldMaps"/>.</summary>
    bool HasMap(string mapId);

    Habitat? FindHabitat(string habitatId);

    /// <summary>The NPC standing in a map, if any. People are authored, so this is the same for every save.</summary>
    MapNpc? FindNpcOnMap(string mapId, string npcId);

    Quest? FindQuest(string questId);

    Region? FindRegion(string regionId);

    /// <summary>The region whose map this is, if any.</summary>
    Region? FindRegionOfMap(string mapId);

    /// <summary>The quest an NPC gives; every NPC gives exactly one.</summary>
    Quest? FindQuestByGiver(string npcId);
}
