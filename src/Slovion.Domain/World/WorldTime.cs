namespace Slovion.Domain.World;

public enum Season
{
    Spring,
    Summer,
    Autumn,
    Winter,
}

public enum TimeOfDay
{
    Morning,
    Day,
    Evening,
    Night,
}

/// <summary>
/// A save's in-game time (docs/decisions.md D8): one real second is one in-game minute, day 1 starts at 08:00
/// when the save is created, and each season lasts three in-game days. <see cref="Minutes"/> counts from day 1 00:00.
/// </summary>
public sealed record WorldTime(long Minutes)
{
    /// <summary>In-game minutes per real second.</summary>
    public const int MinutesPerSecond = 1;

    /// <summary>The in-game time when a save is created: day 1, 08:00.</summary>
    public const long StartMinutes = 8 * 60;

    public const int MinutesPerDay = 24 * 60;

    public const int DaysPerSeason = 3;

    public long Day => (Minutes / MinutesPerDay) + 1;

    public int MinuteOfDay => (int)(Minutes % MinutesPerDay);

    public Season Season => (Season)((Day - 1) / DaysPerSeason % 4);

    /// <summary>Morning 05:00–09:59, day 10:00–17:59, evening 18:00–21:59, night 22:00–04:59.</summary>
    public TimeOfDay TimeOfDay => (MinuteOfDay / 60) switch
    {
        >= 5 and < 10 => TimeOfDay.Morning,
        >= 10 and < 18 => TimeOfDay.Day,
        >= 18 and < 22 => TimeOfDay.Evening,
        _ => TimeOfDay.Night,
    };

    /// <summary>The in-game time of a save created at <paramref name="createdAt"/>, at real time <paramref name="now"/>.</summary>
    public static WorldTime Since(DateTimeOffset createdAt, DateTimeOffset now)
    {
        var seconds = Math.Max(0, (long)Math.Floor((now - createdAt).TotalSeconds));
        return new WorldTime(StartMinutes + (seconds * MinutesPerSecond));
    }
}
