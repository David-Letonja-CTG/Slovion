using System.Globalization;
using Slovion.Api.Errors;
using Slovion.Api.Saves;
using Slovion.Application.Content;

namespace Slovion.Api.World;

public static class MapEndpoints
{
    /// <summary>How a generated map was made, as <c>seed=…; version=…; biomes=…</c>; sent in development only (debug view).</summary>
    public const string WorldHeader = "X-World";

    public static RouteGroupBuilder MapMapEndpoints(this RouteGroupBuilder save)
    {
        save.MapGet("/maps/{mapId}", GetMap)
            .WithName("GetMap")
            .Produces(StatusCodes.Status200OK, contentType: "application/json")
            .Produces(StatusCodes.Status304NotModified)
            .ProducesProblem(StatusCodes.Status404NotFound);

        return save;
    }

    /// <summary>
    /// The save's map as Tiled JSON (D13): authored maps as they are, natural ones generated from the save's world seed.
    /// The entity tag lets the client reuse the map it has; it never changes for a save.
    /// </summary>
    private static IResult GetMap(string mapId, HttpContext httpContext, IWorldMaps maps, IHostEnvironment environment)
    {
        if (maps.Find(SaveTokenFilter.CurrentSlot(httpContext), mapId) is not { } map)
        {
            return ErrorCodes.Problem(StatusCodes.Status404NotFound, ErrorCodes.UnknownMap);
        }

        var headers = httpContext.Response.Headers;
        headers.ETag = map.EntityTag;
        headers.CacheControl = "private, no-cache";
        if (environment.IsDevelopment() && map.World is { } world)
        {
            headers[WorldHeader] = string.Create(CultureInfo.InvariantCulture, $"seed={world.Seed}; version={world.Version}; biomes={string.Join(',', world.Biomes)}");
        }

        return httpContext.Request.Headers.IfNoneMatch.Contains(map.EntityTag)
            ? TypedResults.StatusCode(StatusCodes.Status304NotModified)
            : TypedResults.Bytes(map.Json.ToArray(), "application/json");
    }
}
