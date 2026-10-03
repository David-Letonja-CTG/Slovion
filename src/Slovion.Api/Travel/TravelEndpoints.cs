using Slovion.Api.Content;
using Slovion.Api.Errors;
using Slovion.Api.Saves;
using Slovion.Application.Content;
using Slovion.Application.Travel;

namespace Slovion.Api.Travel;

public sealed record TravelRequest(string? RegionId);

/// <summary>
/// A region for the save. <c>Identified</c> and <c>Required</c> are set for species-count rules only;
/// <c>LockedHint</c> only while the region is locked. <c>X</c> and <c>Y</c> are percent of the travel map.
/// </summary>
public sealed record RegionResponse(string RegionId, string Name, string MapId, int X, int Y, bool Unlocked, int? Identified, int? Required, string? LockedHint);

public sealed record RegionsResponse(string CurrentRegionId, IReadOnlyList<RegionResponse> Regions);

public static class TravelEndpoints
{
    public static RouteGroupBuilder MapTravelEndpoints(this RouteGroupBuilder save)
    {
        save.MapGet("/regions", GetRegions)
            .WithName("GetRegions")
            .Produces<RegionsResponse>();

        save.MapPost("/travel", Travel)
            .WithName("Travel")
            .Produces<RegionResponse>()
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict);

        return save;
    }

    private static async Task<IResult> GetRegions(HttpContext httpContext, TravelService travel, IContentCatalog content, CancellationToken cancellationToken)
    {
        var language = ContentLanguage.Negotiate(httpContext, content);
        var view = await travel.ListAsync(SaveTokenFilter.CurrentSlot(httpContext), language, cancellationToken);
        return TypedResults.Ok(new RegionsResponse(view.CurrentRegionId, view.Regions.Select(ToResponse).ToList()));
    }

    /// <summary>Travels to an unlocked region; the server decides (D3).</summary>
    private static async Task<IResult> Travel(TravelRequest request, HttpContext httpContext, TravelService travel, IContentCatalog content, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.RegionId))
        {
            return ErrorCodes.Problem(StatusCodes.Status400BadRequest, ErrorCodes.BadRequest);
        }

        var language = ContentLanguage.Negotiate(httpContext, content);
        var result = await travel.TravelAsync(SaveTokenFilter.CurrentSlot(httpContext), request.RegionId, language, cancellationToken);
        return result switch
        {
            TravelResult.Travelled travelled => TypedResults.Ok(ToResponse(travelled.Region)),
            TravelResult.Locked => ErrorCodes.Problem(StatusCodes.Status409Conflict, ErrorCodes.RegionLocked),
            _ => ErrorCodes.Problem(StatusCodes.Status404NotFound, ErrorCodes.UnknownRegion),
        };
    }

    private static RegionResponse ToResponse(RegionView region) =>
        new(region.RegionId, region.Name, region.MapId, region.X, region.Y, region.Unlocked, region.Identified, region.Required, region.LockedHint);
}
