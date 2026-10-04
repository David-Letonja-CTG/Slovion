using Slovion.Api.Errors;
using Slovion.Api.Saves;
using Slovion.Application.Wildlife;

namespace Slovion.Api.Wildlife;

/// <summary>
/// A resident animal of a map. <c>Torch</c> is <c>curious</c>, <c>shy</c> or <c>calm</c>; an <c>Aquatic</c> one lives on water
/// tiles only, and a <c>Perched</c> one stays on its home tile (gameplay data).
/// </summary>
public sealed record ResidentResponse(string SpotId, string SpeciesId, string Torch, bool Aquatic, bool Perched, bool Present);

public sealed record WildlifeResponse(IReadOnlyList<ResidentResponse> Animals);

public static class WildlifeEndpoints
{
    public static RouteGroupBuilder MapWildlifeEndpoints(this RouteGroupBuilder save)
    {
        save.MapGet("/wildlife", GetWildlife)
            .WithName("GetWildlife")
            .Produces<WildlifeResponse>()
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status404NotFound);

        return save;
    }

    /// <summary>The map's resident animals and which are around at the save's in-game time (D3, D8).</summary>
    private static IResult GetWildlife(string? mapId, HttpContext httpContext, WildlifeService wildlife)
    {
        if (string.IsNullOrWhiteSpace(mapId))
        {
            return ErrorCodes.Problem(StatusCodes.Status400BadRequest, ErrorCodes.BadRequest);
        }

        var residents = wildlife.List(SaveTokenFilter.CurrentSlot(httpContext), mapId);
        return residents is null
            ? ErrorCodes.Problem(StatusCodes.Status404NotFound, ErrorCodes.UnknownMap)
            : TypedResults.Ok(new WildlifeResponse(residents
                .Select(resident => new ResidentResponse(resident.SpotId, resident.SpeciesId.Value, resident.Torch.ToString().ToLowerInvariant(), resident.Aquatic, resident.Perched, resident.Present))
                .ToList()));
    }
}
