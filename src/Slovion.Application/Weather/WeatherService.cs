using Slovion.Application.Content;
using Slovion.Domain.Saves;
using Slovion.Domain.World;
using WeatherKind = Slovion.Domain.World.Weather;

namespace Slovion.Application.Weather;

/// <summary>A region's current weather and the in-game minute at which it next changes (D11).</summary>
public sealed record WeatherView(WeatherKind Weather, long ChangesAtMinutes);

/// <summary>The weather of the region a map belongs to; the server decides it (D3, D11).</summary>
public sealed class WeatherService(IContentCatalog content, TimeProvider time)
{
    /// <summary>The weather of the map's region at <paramref name="worldTime"/>; clear for a map in no region.</summary>
    public static WeatherKind At(IContentCatalog content, string mapId, WorldTime worldTime)
    {
        ArgumentNullException.ThrowIfNull(content);
        return content.FindRegionOfMap(mapId)?.WeatherAt(worldTime) ?? WeatherKind.Clear;
    }

    /// <summary>The weather now for the save, or <c>null</c> when the map is unknown.</summary>
    public WeatherView? Current(SaveSlot save, string mapId)
    {
        ArgumentNullException.ThrowIfNull(save);
        if (content.SpotsOn(mapId) is null)
        {
            return null;
        }

        var now = WorldTime.Since(save.CreatedAt, time.GetUtcNow());
        return new WeatherView(At(content, mapId, now), WeatherPick.NextChange(now));
    }
}
