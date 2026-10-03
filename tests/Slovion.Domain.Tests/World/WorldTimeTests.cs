using Slovion.Domain.Content;
using Slovion.Domain.World;

namespace Slovion.Domain.Tests.World;

public class WorldTimeTests
{
    private static readonly DateTimeOffset Created = new(2026, 6, 1, 10, 0, 0, TimeSpan.Zero);

    /// <summary>The same cases as the engine's world-time tests (client/src/engine/world/world-time.spec.ts).</summary>
    public static TheoryData<int, long, long, int, Season, TimeOfDay> Cases => new()
    {
        { 0, 480, 1, 480, Season.Spring, TimeOfDay.Morning },
        { 119, 599, 1, 599, Season.Spring, TimeOfDay.Morning },
        { 120, 600, 1, 600, Season.Spring, TimeOfDay.Day },
        { 600, 1080, 1, 1080, Season.Spring, TimeOfDay.Evening },
        { 839, 1319, 1, 1319, Season.Spring, TimeOfDay.Evening },
        { 840, 1320, 1, 1320, Season.Spring, TimeOfDay.Night },
        { 1260, 1740, 2, 300, Season.Spring, TimeOfDay.Morning },
        { 3839, 4319, 3, 1439, Season.Spring, TimeOfDay.Night },
        { 3840, 4320, 4, 0, Season.Summer, TimeOfDay.Night },
        { 4320, 4800, 4, 480, Season.Summer, TimeOfDay.Morning },
        { 12960, 13440, 10, 480, Season.Winter, TimeOfDay.Morning },
        { 17280, 17760, 13, 480, Season.Spring, TimeOfDay.Morning },
    };

    [Theory]
    [MemberData(nameof(Cases))]
    public void Follows_the_clock_rule(int realSeconds, long minutes, long day, int minuteOfDay, Season season, TimeOfDay timeOfDay)
    {
        var time = WorldTime.Since(Created, Created.AddSeconds(realSeconds));

        Assert.Equal((minutes, day, minuteOfDay, season, timeOfDay), (time.Minutes, time.Day, time.MinuteOfDay, time.Season, time.TimeOfDay));
    }

    [Fact]
    public void Ignores_fractions_of_a_second_and_clocks_behind_the_save()
    {
        Assert.Equal(480, WorldTime.Since(Created, Created.AddMilliseconds(999)).Minutes);
        Assert.Equal(480, WorldTime.Since(Created, Created.AddMinutes(-5)).Minutes);
    }

    [Fact]
    public void Availability_needs_both_the_season_and_the_time_of_day()
    {
        var daytimeInSummer = new Availability(new HashSet<Season> { Season.Summer }, new HashSet<TimeOfDay> { TimeOfDay.Morning, TimeOfDay.Day }, ["src"]);

        Assert.True(daytimeInSummer.IsAvailableAt(WorldTime.Since(Created, Created.AddSeconds(4320 + 120))));
        Assert.False(daytimeInSummer.IsAvailableAt(WorldTime.Since(Created, Created.AddSeconds(3840)))); // summer night
        Assert.False(daytimeInSummer.IsAvailableAt(WorldTime.Since(Created, Created)));                // spring morning
    }
}
