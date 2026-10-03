using Slovion.Domain.Content;
using Slovion.Domain.World;

namespace Slovion.Domain.Tests.World;

public class WeatherTests
{
    private static readonly DateTimeOffset Created = new(2026, 6, 1, 0, 0, 0, TimeSpan.Zero);

    private static readonly Dictionary<Weather, int> Mixed = new() { [Weather.Clear] = 3, [Weather.Cloudy] = 2, [Weather.Rain] = 2, [Weather.Fog] = 1, [Weather.Snow] = 2 };

    private static readonly IReadOnlyDictionary<Season, IReadOnlyDictionary<Weather, int>> Weights = new Dictionary<Season, IReadOnlyDictionary<Weather, int>>
    {
        [Season.Spring] = Mixed,
        [Season.Summer] = new Dictionary<Weather, int> { [Weather.Clear] = 1, [Weather.Rain] = 1 },
        [Season.Autumn] = Mixed,
        [Season.Winter] = new Dictionary<Weather, int> { [Weather.Snow] = 1 },
    };

    /// <summary>The in-game time a number of real seconds (= in-game minutes) after the save's creation at 08:00.</summary>
    private static WorldTime At(int seconds) => WorldTime.Since(Created, Created.AddSeconds(seconds));

    [Fact]
    public void The_same_region_day_and_period_always_give_the_same_weather()
    {
        for (var minutes = 0; minutes < 3 * 1440; minutes += 97)
        {
            Assert.Equal(WeatherPick.For("kocevje", At(minutes), Weights), WeatherPick.For("kocevje", At(minutes), Weights));
        }
    }

    [Fact]
    public void Weather_stays_the_same_within_a_6_hour_period()
    {
        // 08:00 to 11:59 of day 1 lie in the period 06:00–11:59.
        var first = WeatherPick.For("pohorje", At(0), Weights);
        for (var minutes = 1; minutes < 240; minutes++)
        {
            Assert.Equal(first, WeatherPick.For("pohorje", At(minutes), Weights));
        }
    }

    [Fact]
    public void Weather_varies_between_periods_and_regions_using_every_weighted_kind()
    {
        // Spring is days 1–3: twelve periods per region.
        var seen = new HashSet<Weather>();
        foreach (var region in new[] { "dravsko_polje", "kocevje", "pohorje", "triglav" })
        {
            for (var minutes = 0; minutes < 3 * 1440 - 480; minutes += 360)
            {
                seen.Add(WeatherPick.For(region, At(minutes), Weights));
            }
        }

        Assert.True(seen.Count >= 4, string.Join(", ", seen));
    }

    [Fact]
    public void Only_weathers_with_a_weight_in_the_season_occur()
    {
        // Summer is days 4–6 (from 3 × 1440 in-game minutes after day 1 00:00, i.e. 3840 seconds after 08:00).
        for (var minutes = 3840; minutes < 3840 + (3 * 1440); minutes += 360)
        {
            Assert.Contains(WeatherPick.For("triglav", At(minutes), Weights), new[] { Weather.Clear, Weather.Rain });
        }

        Assert.Equal(Weather.Clear, WeatherPick.For("triglav", At(0), null));
    }

    [Theory]
    [InlineData(0, 720)]           // day 1, 08:00 → 12:00
    [InlineData(239, 720)]         // 11:59 → 12:00
    [InlineData(240, 1080)]        // 12:00 → 18:00
    [InlineData(960, 1800)]        // day 2, 00:00 → 06:00
    public void The_next_change_is_the_start_of_the_next_period(int seconds, long nextChange)
    {
        Assert.Equal(nextChange, WeatherPick.NextChange(At(seconds)));
    }

    [Fact]
    public void A_species_also_found_in_rain_is_available_in_rain_outside_its_times()
    {
        var salamander = new Availability(
            Enum.GetValues<Season>().ToHashSet(),
            new HashSet<TimeOfDay> { TimeOfDay.Night },
            ["src"],
            new HashSet<Weather> { Weather.Rain });
        var day = At(180); // 11:00

        Assert.True(salamander.IsAvailableAt(day, Weather.Rain));
        Assert.False(salamander.IsAvailableAt(day, Weather.Clear));
        Assert.True(salamander.IsAvailableAt(At(900), Weather.Clear)); // 23:00, night
    }
}
