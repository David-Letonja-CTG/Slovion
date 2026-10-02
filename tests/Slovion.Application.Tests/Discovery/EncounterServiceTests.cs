using Microsoft.Extensions.Time.Testing;
using Slovion.Application.Discovery;
using Slovion.Domain.Content;

namespace Slovion.Application.Tests.Discovery;

public class EncounterServiceTests
{
    private static readonly DateTimeOffset June1 = new(2026, 6, 1, 10, 0, 0, TimeSpan.Zero);
    private readonly FakeTimeProvider time = new(June1);
    private readonly InMemoryDiscoveryRepository discoveries = new();
    private readonly Guid slot = Guid.NewGuid();
    private readonly EncounterService service;

    private static CancellationToken Token => TestContext.Current.CancellationToken;

    public EncounterServiceTests()
    {
        var catalog = new FakeContentCatalog(
            FakeContentCatalog.Species("salvia_pratensis", "travniška kadulja", "meadow clary"),
            FakeContentCatalog.Species("taraxacum_officinale", "navadni regrat"),
            FakeContentCatalog.Species("lepus_europaeus", "poljski zajec", group: SpeciesGroup.Mammal),
            FakeContentCatalog.Species("alauda_arvensis", "poljski škrjanec", group: SpeciesGroup.Bird),
            FakeContentCatalog.Species("papilio_machaon", "lastovičar", group: SpeciesGroup.Insect));
        service = new EncounterService(catalog, discoveries, new InMemoryEncounterRepository(), new SeededRandom(1), time);
    }

    private async Task<EncounterView> Start(string spotId, string language = "sl") =>
        Assert.IsType<StartEncounterResult.Started>(
            await service.StartAsync(slot, FakeContentCatalog.MapId, spotId, language, Token)).Encounter;

    private async Task<AnswerResult.Answered> Answer(EncounterView encounter, string speciesId) =>
        Assert.IsType<AnswerResult.Answered>(await service.AnswerAsync(slot, encounter.EncounterId, speciesId, "sl", Token));

    [Fact]
    public async Task Starting_offers_clues_and_candidates_without_revealing_the_answer()
    {
        var encounter = await Start("lepus_europaeus");

        Assert.Equal(SpeciesGroup.Mammal, encounter.Group);
        Assert.Equal(["poljski zajec trait 3", "poljski zajec trait 0", "poljski zajec trait 1"], encounter.Clues);
        Assert.Equal(4, encounter.Candidates.Count);
        Assert.Contains(encounter.Candidates, c => c.SpeciesId.Value == "lepus_europaeus" && c.Name == "poljski zajec");
    }

    [Fact]
    public async Task Clues_and_names_use_the_requested_language()
    {
        var encounter = await Start("salvia_pratensis", "en");

        Assert.Equal("meadow clary trait 3", encounter.Clues[0]);
        Assert.Contains(encounter.Candidates, c => c.Name == "meadow clary");
        Assert.Contains(encounter.Candidates, c => c.Name == "poljski zajec" || c.Name == "navadni regrat" || c.Name == "lastovičar" || c.Name == "poljski škrjanec");
    }

    [Fact]
    public async Task Starting_records_the_first_observation_only_once()
    {
        await Start("lepus_europaeus");
        time.Advance(TimeSpan.FromHours(1));
        await Start("lepus_europaeus");

        var entry = Assert.Single(await discoveries.ListAsync(slot, Token));
        Assert.Equal(June1, entry.ObservedAt);
        Assert.False(entry.IsIdentified);
    }

    [Fact]
    public async Task Correct_answer_identifies_with_server_time()
    {
        var encounter = await Start("taraxacum_officinale");
        time.Advance(TimeSpan.FromMinutes(5));

        var result = await Answer(encounter, "taraxacum_officinale");

        Assert.True(result.Correct);
        Assert.Equal("navadni regrat", result.CorrectSpecies.Name);
        Assert.Equal(June1.AddMinutes(5), result.Entry?.IdentifiedAt);
        Assert.Equal("navadni regrat", result.Entry?.Species?.Name);
    }

    [Fact]
    public async Task Wrong_answer_names_the_correct_species_and_changes_nothing_else()
    {
        var encounter = await Start("taraxacum_officinale");
        var wrong = encounter.Candidates.First(c => c.SpeciesId.Value != "taraxacum_officinale");

        var result = await Answer(encounter, wrong.SpeciesId.Value);

        Assert.False(result.Correct);
        Assert.Equal("taraxacum_officinale", result.CorrectSpecies.SpeciesId.Value);
        Assert.Null(result.Entry);
        Assert.False(Assert.Single(await discoveries.ListAsync(slot, Token)).IsIdentified);
    }

    [Fact]
    public async Task An_identified_species_opens_no_new_encounter()
    {
        await Answer(await Start("salvia_pratensis"), "salvia_pratensis");

        var result = await service.StartAsync(slot, FakeContentCatalog.MapId, "salvia_pratensis", "sl", Token);

        var known = Assert.IsType<StartEncounterResult.AlreadyIdentified>(result);
        Assert.Equal("travniška kadulja", known.Entry.Species?.Name);
    }

    [Fact]
    public async Task Answering_twice_is_an_unknown_encounter()
    {
        var encounter = await Start("salvia_pratensis");
        await Answer(encounter, "salvia_pratensis");

        var again = await service.AnswerAsync(slot, encounter.EncounterId, "salvia_pratensis", "sl", Token);

        Assert.IsType<AnswerResult.UnknownEncounter>(again);
    }

    [Fact]
    public async Task A_newer_encounter_replaces_the_open_one()
    {
        var hare = await Start("lepus_europaeus");
        await Start("alauda_arvensis");

        var result = await service.AnswerAsync(slot, hare.EncounterId, "lepus_europaeus", "sl", Token);

        Assert.IsType<AnswerResult.UnknownEncounter>(result);
    }

    [Fact]
    public async Task Another_saves_encounter_is_unknown()
    {
        var encounter = await Start("lepus_europaeus");

        var result = await service.AnswerAsync(Guid.NewGuid(), encounter.EncounterId, "lepus_europaeus", "sl", Token);

        Assert.IsType<AnswerResult.UnknownEncounter>(result);
    }

    [Theory]
    [InlineData("vulpes_vulpes")]
    [InlineData("Not-An-Id")]
    public async Task An_answer_that_was_not_offered_leaves_the_encounter_open(string answer)
    {
        var encounter = await Start("lepus_europaeus");

        var result = await service.AnswerAsync(slot, encounter.EncounterId, answer, "sl", Token);

        Assert.IsType<AnswerResult.NotACandidate>(result);
        Assert.True((await Answer(encounter, "lepus_europaeus")).Correct);
    }

    [Theory]
    [InlineData("test_meadow", "does_not_exist")]
    [InlineData("other_map", "salvia_pratensis")]
    public async Task Unknown_spot_records_nothing(string mapId, string spotId)
    {
        var result = await service.StartAsync(slot, mapId, spotId, "sl", Token);

        Assert.IsType<StartEncounterResult.UnknownSpot>(result);
        Assert.Empty(await discoveries.ListAsync(slot, Token));
    }
}
