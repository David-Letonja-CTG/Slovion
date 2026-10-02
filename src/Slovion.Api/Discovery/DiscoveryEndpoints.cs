using System.Globalization;
using Slovion.Api.Content;
using Slovion.Api.Errors;
using Slovion.Api.Saves;
using Slovion.Application.Content;
using Slovion.Application.Discovery;

namespace Slovion.Api.Discovery;

public sealed record DiscoveryRequest(string? MapId, string? SpotId);

public sealed record SourceResponse(string Title, string Publisher, string Url, string Accessed, string Licence);

public sealed record SpeciesResponse(
    string Name,
    string ScientificName,
    string Family,
    string Habitat,
    string Distribution,
    string Season,
    IReadOnlyList<string> Characteristics,
    IReadOnlyList<SourceResponse> Sources);

public sealed record NatureDexEntryResponse(string SpeciesId, DateTime DiscoveredAt, SpeciesResponse Species);

public sealed record NatureDexResponse(IReadOnlyList<NatureDexEntryResponse> Entries);

public sealed record DiscoveryResponse(string SpeciesId, bool IsNew, DateTime DiscoveredAt, SpeciesResponse Species);

public static class DiscoveryEndpoints
{
    public static RouteGroupBuilder MapDiscoveryEndpoints(this RouteGroupBuilder save)
    {
        save.MapPost("/discoveries", RecordDiscovery)
            .WithName("RecordDiscovery")
            .Produces<DiscoveryResponse>(StatusCodes.Status201Created)
            .Produces<DiscoveryResponse>(StatusCodes.Status200OK)
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status404NotFound);

        save.MapGet("/naturedex", GetNatureDex)
            .WithName("GetNatureDex")
            .Produces<NatureDexResponse>();

        return save;
    }

    private static async Task<IResult> RecordDiscovery(
        DiscoveryRequest request,
        HttpContext httpContext,
        DiscoveryService discoveries,
        IContentCatalog content,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.MapId) || string.IsNullOrWhiteSpace(request.SpotId))
        {
            return ErrorCodes.Problem(StatusCodes.Status400BadRequest, ErrorCodes.BadRequest);
        }

        var language = ContentLanguage.Negotiate(httpContext, content);
        var slot = SaveTokenFilter.CurrentSlot(httpContext);
        var result = await discoveries.RecordAsync(slot.Id, request.MapId, request.SpotId, language, cancellationToken);

        return result switch
        {
            RecordDiscoveryResult.Recorded recorded => TypedResults.Json(
                new DiscoveryResponse(
                    recorded.Entry.SpeciesId.Value,
                    recorded.IsNew,
                    recorded.Entry.DiscoveredAt.UtcDateTime,
                    ToResponse(recorded.Entry.Species)),
                statusCode: recorded.IsNew ? StatusCodes.Status201Created : StatusCodes.Status200OK),
            _ => ErrorCodes.Problem(StatusCodes.Status404NotFound, ErrorCodes.UnknownSpot),
        };
    }

    private static async Task<IResult> GetNatureDex(
        HttpContext httpContext,
        DiscoveryService discoveries,
        IContentCatalog content,
        CancellationToken cancellationToken)
    {
        var language = ContentLanguage.Negotiate(httpContext, content);
        var slot = SaveTokenFilter.CurrentSlot(httpContext);
        var entries = await discoveries.GetNatureDexAsync(slot.Id, language, cancellationToken);

        return TypedResults.Ok(new NatureDexResponse(entries
            .Select(entry => new NatureDexEntryResponse(
                entry.SpeciesId.Value,
                entry.DiscoveredAt.UtcDateTime,
                ToResponse(entry.Species)))
            .ToList()));
    }

    private static SpeciesResponse ToResponse(SpeciesView species) => new(
        species.Name,
        species.ScientificName,
        species.Family,
        species.Habitat,
        species.Distribution,
        species.Season,
        species.Characteristics,
        species.Sources
            .Select(source => new SourceResponse(
                source.Title,
                source.Publisher,
                source.Url.ToString(),
                source.Accessed.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                source.Licence))
            .ToList());
}
