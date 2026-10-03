using Slovion.Api.Errors;
using Slovion.Api.Saves;
using Slovion.Application.Weather;

namespace Slovion.Api.World;

/// <summary>
/// The weather of a map's region now: <c>clear</c>, <c>cloudy</c>, <c>rain</c>, <c>fog</c> or <c>snow</c>, and the in-game
/// minute (counted from day 1 00:00, like <see cref="TimeResponse"/>) at which it next changes.
/// </summary>
public sealed record WeatherResponse(string Weather, long ChangesAtMinutes);

public static class WeatherEndpoints
{
    public static RouteGroupBuilder MapWeatherEndpoints(this RouteGroupBuilder save)
    {
        save.MapGet("/weather", GetWeather)
            .WithName("GetWeather")
            .Produces<WeatherResponse>()
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status404NotFound);

        return save;
    }

    /// <summary>The server decides the weather (docs/decisions.md D3, D11).</summary>
    private static IResult GetWeather(string? mapId, HttpContext httpContext, WeatherService weather)
    {
        if (string.IsNullOrWhiteSpace(mapId))
        {
            return ErrorCodes.Problem(StatusCodes.Status400BadRequest, ErrorCodes.BadRequest);
        }

        var current = weather.Current(SaveTokenFilter.CurrentSlot(httpContext), mapId);
        return current is null
            ? ErrorCodes.Problem(StatusCodes.Status404NotFound, ErrorCodes.UnknownMap)
            : TypedResults.Ok(new WeatherResponse(current.Weather.ToString().ToLowerInvariant(), current.ChangesAtMinutes));
    }
}
