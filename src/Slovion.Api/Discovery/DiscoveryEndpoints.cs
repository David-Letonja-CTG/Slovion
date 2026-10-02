using System.Globalization;
using Slovion.Api.Content;
using Slovion.Api.Errors;
using Slovion.Api.Saves;
using Slovion.Application.Content;
using Slovion.Application.Discovery;
using Slovion.Domain.Content;

namespace Slovion.Api.Discovery;

public sealed record StartEncounterRequest(string? MapId, string? SpotId);

public sealed record AnswerRequest(string? SpeciesId);

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

/// <summary>A NatureDex entry. <c>Species</c> is present only when <c>Status</c> is <c>identified</c>.</summary>
public sealed record NatureDexEntryResponse(
    string SpeciesId,
    string Group,
    string Status,
    DateTime ObservedAt,
    DateTime? IdentifiedAt,
    SpeciesResponse? Species);

public sealed record NatureDexResponse(IReadOnlyList<NatureDexEntryResponse> Entries);

public sealed record CandidateResponse(string SpeciesId, string Name);

/// <summary>An open encounter. It never says which candidate is correct.</summary>
public sealed record EncounterResponse(
    Guid EncounterId,
    string Group,
    IReadOnlyList<string> Clues,
    IReadOnlyList<CandidateResponse> Candidates);

public sealed record AlreadyIdentifiedResponse(bool AlreadyIdentified, NatureDexEntryResponse Entry);

public sealed record AnswerResponse(bool Correct, CandidateResponse Species, NatureDexEntryResponse? Entry);

public static class DiscoveryEndpoints
{
    public static RouteGroupBuilder MapDiscoveryEndpoints(this RouteGroupBuilder save)
    {
        save.MapPost("/encounters", StartEncounter)
            .WithName("StartEncounter")
            .Produces<EncounterResponse>(StatusCodes.Status201Created)
            .Produces<AlreadyIdentifiedResponse>(StatusCodes.Status200OK)
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status404NotFound);

        save.MapPost("/encounters/{encounterId:guid}/identification", Answer)
            .WithName("AnswerEncounter")
            .Produces<AnswerResponse>()
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status404NotFound);

        save.MapGet("/naturedex", GetNatureDex)
            .WithName("GetNatureDex")
            .Produces<NatureDexResponse>();

        return save;
    }

    private static async Task<IResult> StartEncounter(
        StartEncounterRequest request,
        HttpContext httpContext,
        EncounterService encounters,
        IContentCatalog content,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.MapId) || string.IsNullOrWhiteSpace(request.SpotId))
        {
            return ErrorCodes.Problem(StatusCodes.Status400BadRequest, ErrorCodes.BadRequest);
        }

        var language = ContentLanguage.Negotiate(httpContext, content);
        var slot = SaveTokenFilter.CurrentSlot(httpContext);
        var result = await encounters.StartAsync(slot.Id, request.MapId, request.SpotId, language, cancellationToken);

        return result switch
        {
            StartEncounterResult.Started started => TypedResults.Json(
                new EncounterResponse(
                    started.Encounter.EncounterId,
                    started.Encounter.Group.ToName(),
                    started.Encounter.Clues,
                    started.Encounter.Candidates.Select(ToResponse).ToList()),
                statusCode: StatusCodes.Status201Created),
            StartEncounterResult.AlreadyIdentified known => TypedResults.Ok(
                new AlreadyIdentifiedResponse(true, ToResponse(known.Entry))),
            _ => ErrorCodes.Problem(StatusCodes.Status404NotFound, ErrorCodes.UnknownSpot),
        };
    }

    private static async Task<IResult> Answer(
        Guid encounterId,
        AnswerRequest request,
        HttpContext httpContext,
        EncounterService encounters,
        IContentCatalog content,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.SpeciesId))
        {
            return ErrorCodes.Problem(StatusCodes.Status400BadRequest, ErrorCodes.BadRequest);
        }

        var language = ContentLanguage.Negotiate(httpContext, content);
        var slot = SaveTokenFilter.CurrentSlot(httpContext);
        var result = await encounters.AnswerAsync(slot.Id, encounterId, request.SpeciesId, language, cancellationToken);

        return result switch
        {
            AnswerResult.Answered answered => TypedResults.Ok(new AnswerResponse(
                answered.Correct,
                ToResponse(answered.CorrectSpecies),
                answered.Entry is null ? null : ToResponse(answered.Entry))),
            AnswerResult.NotACandidate => ErrorCodes.Problem(StatusCodes.Status400BadRequest, ErrorCodes.BadRequest),
            _ => ErrorCodes.Problem(StatusCodes.Status404NotFound, ErrorCodes.UnknownEncounter),
        };
    }

    private static async Task<IResult> GetNatureDex(
        HttpContext httpContext,
        NatureDexService natureDex,
        IContentCatalog content,
        CancellationToken cancellationToken)
    {
        var language = ContentLanguage.Negotiate(httpContext, content);
        var slot = SaveTokenFilter.CurrentSlot(httpContext);
        var entries = await natureDex.GetAsync(slot.Id, language, cancellationToken);

        return TypedResults.Ok(new NatureDexResponse(entries.Select(ToResponse).ToList()));
    }

    private static CandidateResponse ToResponse(CandidateView candidate) => new(candidate.SpeciesId.Value, candidate.Name);

    private static NatureDexEntryResponse ToResponse(NatureDexEntry entry) => new(
        entry.SpeciesId.Value,
        entry.Group.ToName(),
        entry.IsIdentified ? "identified" : "observed",
        entry.ObservedAt.UtcDateTime,
        entry.IdentifiedAt?.UtcDateTime,
        entry.Species is null ? null : ToResponse(entry.Species));

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
