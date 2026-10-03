using System.Text;

namespace Slovion.Domain.World;

/// <summary>A region's weather (docs/decisions.md D11). The order is fixed: weighted picks walk it.</summary>
public enum Weather
{
    Clear,
    Cloudy,
    Rain,
    Fog,
    Snow,
}

/// <summary>
/// Picks a region's weather for an in-game moment (D11): it stays the same within each 6-hour period of an in-game
/// day and is chosen deterministically from the region, the day and the period, weighted by the region's weights for
/// the current season. A pure function: the same input always gives the same weather.
/// </summary>
public static class WeatherPick
{
    /// <summary>In-game minutes per weather period (6 hours).</summary>
    public const int MinutesPerPeriod = 6 * 60;

    /// <summary>The weather of <paramref name="regionId"/> at <paramref name="time"/>; clear when the season has no weights.</summary>
    public static Weather For(string regionId, WorldTime time, IReadOnlyDictionary<Season, IReadOnlyDictionary<Weather, int>>? weights)
    {
        ArgumentNullException.ThrowIfNull(regionId);
        ArgumentNullException.ThrowIfNull(time);
        if (weights is null || !weights.TryGetValue(time.Season, out var season) || season.Values.Sum() <= 0)
        {
            return Weather.Clear;
        }

        var period = time.MinuteOfDay / MinutesPerPeriod;
        var roll = (int)(Fnv1a($"{regionId}:{time.Day}:{period}") % (uint)season.Values.Sum());
        foreach (var kind in Enum.GetValues<Weather>())
        {
            var weight = season.GetValueOrDefault(kind);
            if (roll < weight)
            {
                return kind;
            }

            roll -= weight;
        }

        throw new InvalidOperationException("Weighted roll out of range.");
    }

    /// <summary>The in-game minute (counted like <see cref="WorldTime.Minutes"/>) at which the next weather period starts.</summary>
    public static long NextChange(WorldTime time)
    {
        ArgumentNullException.ThrowIfNull(time);
        return ((time.Minutes / MinutesPerPeriod) + 1) * MinutesPerPeriod;
    }

    /// <summary>32-bit FNV-1a over the UTF-8 bytes of <paramref name="text"/>.</summary>
    private static uint Fnv1a(string text)
    {
        var hash = 2166136261u;
        foreach (var b in Encoding.UTF8.GetBytes(text))
        {
            hash = unchecked((hash ^ b) * 16777619u);
        }

        return hash;
    }
}
