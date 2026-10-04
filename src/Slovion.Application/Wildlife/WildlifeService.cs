using Slovion.Application.Content;
using Slovion.Application.Weather;
using Slovion.Domain.Content;
using Slovion.Domain.Saves;
using Slovion.Domain.World;

namespace Slovion.Application.Wildlife;

/// <summary>A resident animal of a map: the animal of a spot, present only while its species is available (D8, D11).</summary>
public sealed record ResidentView(string SpotId, SpeciesId SpeciesId, TorchReaction Torch, bool Aquatic, bool Perched, bool Present);

/// <summary>Which animals live on a map and which of them are around at the save's in-game time.</summary>
public sealed class WildlifeService(IContentCatalog content, TimeProvider time)
{
    /// <summary>Every resident of the map, or <c>null</c> when the map is unknown.</summary>
    public IReadOnlyList<ResidentView>? List(SaveSlot save, string mapId)
    {
        ArgumentNullException.ThrowIfNull(save);
        if (content.SpotsOn(mapId) is not { } spots)
        {
            return null;
        }

        var now = WorldTime.Since(save.CreatedAt, time.GetUtcNow());
        var weather = WeatherService.At(content, mapId, now);
        return spots
            .Select(spot => (spot, species: content.FindSpecies(spot.SpeciesId)))
            .Where(pair => pair.species?.Wildlife is not null)
            .OrderBy(pair => pair.spot.SpotId, StringComparer.Ordinal)
            .Select(pair => new ResidentView(pair.spot.SpotId, pair.spot.SpeciesId, pair.species!.Wildlife!.Torch, pair.species.Wildlife.Aquatic, pair.species.Wildlife.Perched, pair.species.Availability.IsAvailableAt(now, weather)))
            .ToList();
    }
}
