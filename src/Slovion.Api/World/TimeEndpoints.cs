using Microsoft.AspNetCore.Http.HttpResults;
using Slovion.Api.Saves;
using Slovion.Domain.World;

namespace Slovion.Api.World;

/// <summary>A save's in-game time. Season and time of day are lowercase names; minutes count from day 1 00:00.</summary>
public sealed record TimeResponse(long Minutes, long Day, string Season, string TimeOfDay, int GameMinutesPerSecond);

public static class TimeEndpoints
{
    public static RouteGroupBuilder MapTimeEndpoints(this RouteGroupBuilder save)
    {
        save.MapGet("/time", GetTime)
            .WithName("GetWorldTime")
            .Produces<TimeResponse>();

        return save;
    }

    /// <summary>The save's in-game time, from its age and the server clock (docs/decisions.md D3, D8).</summary>
    private static Ok<TimeResponse> GetTime(HttpContext httpContext, TimeProvider time)
    {
        var slot = SaveTokenFilter.CurrentSlot(httpContext);
        var now = WorldTime.Since(slot.CreatedAt, time.GetUtcNow());

        return TypedResults.Ok(new TimeResponse(
            now.Minutes,
            now.Day,
            now.Season.ToString().ToLowerInvariant(),
            now.TimeOfDay.ToString().ToLowerInvariant(),
            WorldTime.MinutesPerSecond));
    }
}
