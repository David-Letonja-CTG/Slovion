using Slovion.Api.Content;
using Slovion.Api.Saves;
using Slovion.Application.Content;
using Slovion.Application.Stations;

namespace Slovion.Api.Stations;

/// <summary>A station's species for the save: research level 0 and no name until identified.</summary>
public sealed record StationSpeciesResponse(string SpeciesId, int Level, string? Name);

/// <summary>A research station with the save's progress: how many of its species are fully researched, and whether that meets its goal.</summary>
public sealed record StationResponse(string StationId, string Name, string Theme, string MapId, int Goal, int Researched, bool Met, IReadOnlyList<StationSpeciesResponse> Species);

public sealed record StationsResponse(IReadOnlyList<StationResponse> Stations);

public static class StationEndpoints
{
    public static RouteGroupBuilder MapStationEndpoints(this RouteGroupBuilder save)
    {
        save.MapGet("/stations", GetStations)
            .WithName("GetStations")
            .Produces<StationsResponse>();

        return save;
    }

    private static async Task<IResult> GetStations(HttpContext httpContext, StationService stations, IContentCatalog content, CancellationToken cancellationToken)
    {
        var language = ContentLanguage.Negotiate(httpContext, content);
        var views = await stations.ListAsync(SaveTokenFilter.CurrentSlot(httpContext), language, cancellationToken);
        return TypedResults.Ok(new StationsResponse(views.Select(ToResponse).ToList()));
    }

    private static StationResponse ToResponse(StationView view) =>
        new(view.StationId, view.Name, view.Theme, view.MapId, view.Goal, view.Researched, view.Met, view.Species.Select(species => new StationSpeciesResponse(species.SpeciesId.Value, species.Level, species.Name)).ToList());
}
