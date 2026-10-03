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

    Species? FindSpecies(SpeciesId id);

    MapSpot? FindSpot(string mapId, string spotId);

    /// <summary>The NPC standing in a map, if any.</summary>
    MapNpc? FindNpcOnMap(string mapId, string npcId);

    Quest? FindQuest(string questId);

    /// <summary>The quest an NPC gives; every NPC gives exactly one.</summary>
    Quest? FindQuestByGiver(string npcId);

    /// <summary>The habitat whose zone contains tile (<paramref name="x"/>, <paramref name="y"/>) of a map, if any.</summary>
    Habitat? FindHabitatAt(string mapId, int x, int y);
}
