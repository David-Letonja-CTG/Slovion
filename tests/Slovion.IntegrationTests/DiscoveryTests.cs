using System.Net;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Time.Testing;
using Slovion.Infrastructure.Persistence;
using Slovion.IntegrationTests.Infrastructure;
using static Slovion.IntegrationTests.Infrastructure.GameApiClient;

namespace Slovion.IntegrationTests;

[Collection(DatabaseCollectionDefinition.Name)]
public sealed class DiscoveryTests(PostgresFixture database)
{
    private static readonly DateTimeOffset June1 = new(2026, 6, 1, 10, 0, 0, TimeSpan.Zero);

    private SlovionApiFactory Factory(FakeTimeProvider? time = null) =>
        new(database.ConnectionString, configureServices: services =>
        {
            if (time is not null)
            {
                services.AddSingleton<TimeProvider>(time);
            }
        });

    private static CancellationToken Token => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Starting_an_encounter_offers_clues_and_candidates_without_the_answer()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);

        using var response = await StartEncounterAsync(client, token, "dravsko_polje_meadow_taraxacum_officinale_1");

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        using var body = await ReadJsonAsync(response);
        var root = body.RootElement;
        Assert.Equal("plant", root.GetProperty("group").GetString());
        Assert.Equal(
            ["Košek sestavljajo številni rumeni jezičasti cvetovi.", "Listi rastejo v pritlični rozeti; so suličasti in globoko zarezani.", "Rastlina vsebuje bel sok."],
            root.GetProperty("clues").EnumerateArray().Select(c => c.GetString()));
        var candidates = root.GetProperty("candidates").EnumerateArray().ToList();
        Assert.Equal(4, candidates.Count);
        Assert.Contains(candidates, c => c.GetProperty("speciesId").GetString() == "taraxacum_officinale" && c.GetProperty("name").GetString() == "navadni regrat");
        Assert.All(candidates, c => Assert.Equal(["speciesId", "name"], c.EnumerateObject().Select(p => p.Name)));
        Assert.Equal(["encounterId", "group", "clues", "candidates"], root.EnumerateObject().Select(p => p.Name));
    }

    [Fact]
    public async Task First_encounter_records_an_observation_once()
    {
        var time = new FakeTimeProvider(June1);
        await using var factory = Factory(time);
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);

        await OpenEncounterAsync(client, token, HareSpot);
        time.Advance(TimeSpan.FromHours(1));
        await OpenEncounterAsync(client, token, HareSpot);

        var entry = Assert.Single(await NatureDexEntriesAsync(client, token));
        Assert.Equal(("lepus_europaeus", "mammal", "observed"), (entry.GetProperty("speciesId").GetString(), entry.GetProperty("group").GetString(), entry.GetProperty("status").GetString()));
        Assert.Equal("2026-06-01T10:00:00Z", entry.GetProperty("observedAt").GetString());
        Assert.Equal(JsonValueKind.Null, entry.GetProperty("species").ValueKind);
        Assert.Equal(JsonValueKind.Null, entry.GetProperty("identifiedAt").ValueKind);
    }

    [Fact]
    public async Task Correct_answer_identifies_at_server_time()
    {
        var time = new FakeTimeProvider(June1);
        await using var factory = Factory(time);
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);
        var encounterId = await OpenEncounterAsync(client, token, "dravsko_polje_meadow_taraxacum_officinale_1");
        time.Advance(TimeSpan.FromMinutes(5));

        using var response = await AnswerAsync(client, token, encounterId, "taraxacum_officinale");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var body = await ReadJsonAsync(response);
        Assert.True(body.RootElement.GetProperty("correct").GetBoolean());
        Assert.Equal("navadni regrat", body.RootElement.GetProperty("species").GetProperty("name").GetString());
        var entry = body.RootElement.GetProperty("entry");
        Assert.Equal("identified", entry.GetProperty("status").GetString());
        Assert.Equal("2026-06-01T10:05:00Z", entry.GetProperty("identifiedAt").GetString());
        Assert.Equal("navadni regrat", entry.GetProperty("species").GetProperty("name").GetString());
    }

    [Fact]
    public async Task Wrong_answer_names_the_species_and_keeps_it_observed()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);
        using var start = await StartEncounterAsync(client, token, "dravsko_polje_meadow_taraxacum_officinale_1");
        using var startBody = await ReadJsonAsync(start);
        var encounterId = startBody.RootElement.GetProperty("encounterId").GetGuid();
        var wrong = startBody.RootElement.GetProperty("candidates").EnumerateArray()
            .Select(c => c.GetProperty("speciesId").GetString()!)
            .First(id => id != "taraxacum_officinale");

        using var response = await AnswerAsync(client, token, encounterId, wrong);

        using var body = await ReadJsonAsync(response);
        Assert.False(body.RootElement.GetProperty("correct").GetBoolean());
        Assert.Equal("taraxacum_officinale", body.RootElement.GetProperty("species").GetProperty("speciesId").GetString());
        Assert.Equal("navadni regrat", body.RootElement.GetProperty("species").GetProperty("name").GetString());
        Assert.Equal(JsonValueKind.Null, body.RootElement.GetProperty("entry").ValueKind);
        Assert.Equal("observed", Assert.Single(await NatureDexEntriesAsync(client, token)).GetProperty("status").GetString());
    }

    [Fact]
    public async Task Identified_species_opens_no_new_encounter()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);
        await IdentifyAsync(client, token, SageSpot, Sage);

        using var response = await StartEncounterAsync(client, token, SageSpot);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var body = await ReadJsonAsync(response);
        Assert.True(body.RootElement.GetProperty("alreadyIdentified").GetBoolean());
        Assert.Equal("travniška kadulja", body.RootElement.GetProperty("entry").GetProperty("species").GetProperty("name").GetString());
    }

    [Fact]
    public async Task Answering_twice_is_an_unknown_encounter()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);
        var encounterId = await OpenEncounterAsync(client, token, SageSpot);
        using var first = await AnswerAsync(client, token, encounterId, Sage);

        using var second = await AnswerAsync(client, token, encounterId, Sage);

        await AssertProblem(second, HttpStatusCode.NotFound, "unknown_encounter");
    }

    [Fact]
    public async Task A_newer_encounter_closes_the_open_one()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);
        var hare = await OpenEncounterAsync(client, token, HareSpot);
        await OpenEncounterAsync(client, token, SkylarkSpot);

        using var response = await AnswerAsync(client, token, hare, Hare);

        await AssertProblem(response, HttpStatusCode.NotFound, "unknown_encounter");
    }

    [Fact]
    public async Task Another_saves_encounter_is_unknown()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        var owner = await CreateSaveAsync(client);
        var stranger = await CreateSaveAsync(client);
        var encounterId = await OpenEncounterAsync(client, owner, HareSpot);

        using var response = await AnswerAsync(client, stranger, encounterId, Hare);

        await AssertProblem(response, HttpStatusCode.NotFound, "unknown_encounter");
    }

    [Fact]
    public async Task Made_up_encounter_is_unknown()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);

        using var response = await AnswerAsync(client, token, Guid.NewGuid(), Hare);

        await AssertProblem(response, HttpStatusCode.NotFound, "unknown_encounter");
    }

    [Fact]
    public async Task Species_that_was_not_offered_is_a_bad_request_and_keeps_the_encounter_open()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);
        var encounterId = await OpenEncounterAsync(client, token, HareSpot);

        using var bad = await AnswerAsync(client, token, encounterId, "vulpes_vulpes");
        using var good = await AnswerAsync(client, token, encounterId, Hare);

        await AssertProblem(bad, HttpStatusCode.BadRequest, "bad_request");
        Assert.Equal(HttpStatusCode.OK, good.StatusCode);
    }

    [Theory]
    [InlineData(MeadowMap, "does_not_exist")]
    [InlineData("no_such_map", SageSpot)]
    public async Task Unknown_spot_returns_404_and_records_nothing(string mapId, string spotId)
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);

        using var response = await StartEncounterAsync(client, token, spotId, mapId);

        await AssertProblem(response, HttpStatusCode.NotFound, "unknown_spot");
        Assert.Empty(await NatureDexEntriesAsync(client, token));
    }

    [Fact]
    public async Task Concurrent_starts_leave_one_open_encounter_and_one_observation()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);

        var responses = await Task.WhenAll(StartEncounterAsync(client, token, HareSpot), StartEncounterAsync(client, token, HareSpot));

        Assert.All(responses, r => Assert.Equal(HttpStatusCode.Created, r.StatusCode));
        Assert.Single(await NatureDexEntriesAsync(client, token));
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<SlovionDbContext>();
        var hash = Slovion.Application.Saves.SaveToken.Hash(token);
        var slotId = (await db.SaveSlots.SingleAsync(slot => slot.TokenHash == hash, Token)).Id;
        Assert.Equal(2, await db.Encounters.CountAsync(e => e.SaveSlotId == slotId, Token));
        Assert.Equal(1, await db.Encounters.CountAsync(e => e.SaveSlotId == slotId && e.ClosedAt == null, Token));
        foreach (var response in responses)
        {
            response.Dispose();
        }
    }

    [Fact]
    public async Task Identifications_survive_an_api_restart()
    {
        string token;
        await using (var before = Factory())
        {
            using var client = before.CreateClient();
            token = await CreateSaveAsync(client);
            await IdentifyAsync(client, token, SageSpot, Sage);
        }

        await using var after = Factory();
        using var restarted = after.CreateClient();
        var entry = Assert.Single(await NatureDexEntriesAsync(restarted, token));

        Assert.Equal(("salvia_pratensis", "identified"), (entry.GetProperty("speciesId").GetString(), entry.GetProperty("status").GetString()));
    }

    [Fact]
    public async Task Identified_entry_contains_sourced_slovenian_information()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);
        await IdentifyAsync(client, token, SageSpot, Sage);

        var entry = Assert.Single(await NatureDexEntriesAsync(client, token));

        var species = entry.GetProperty("species");
        Assert.Equal("travniška kadulja", species.GetProperty("name").GetString());
        Assert.Equal("Salvia pratensis L.", species.GetProperty("scientificName").GetString());
        Assert.Equal(4, species.GetProperty("characteristics").GetArrayLength());
        Assert.Equal(
            ["Botanični vrt Univerze v Ljubljani", "Notranjski regijski park", "GBIF Secretariat"],
            species.GetProperty("sources").EnumerateArray().Select(s => s.GetProperty("publisher").GetString()));
    }

    [Theory]
    [InlineData("sl")]
    [InlineData("sl-SI")]
    [InlineData("de")]
    [InlineData("en-GB, de;q=0.8")]
    [InlineData(null)]
    public async Task Content_is_slovenian_and_declared_as_such(string? acceptLanguage)
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);
        await IdentifyAsync(client, token, SageSpot, Sage);

        using var dex = await GetNatureDexAsync(client, token, acceptLanguage);
        using var encounter = await StartEncounterAsync(client, token, HareSpot, acceptLanguage: acceptLanguage);

        Assert.Equal(["sl"], dex.Content.Headers.ContentLanguage);
        Assert.Equal(["sl"], encounter.Content.Headers.ContentLanguage);
        using var body = await ReadJsonAsync(dex);
        var entry = Assert.Single(NatureDexEntries(body.RootElement));
        Assert.Equal("Visoka trava", body.RootElement.GetProperty("habitats")[0].GetProperty("name").GetString());
        Assert.Equal("travniška kadulja", entry.GetProperty("species").GetProperty("name").GetString());
    }

    [Fact]
    public async Task Requests_without_map_spot_or_answer_are_bad_requests()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);
        var encounterId = await OpenEncounterAsync(client, token, HareSpot);

        using var noSpot = await StartEncounterAsync(client, token, spotId: "");
        using var noAnswer = await AnswerAsync(client, token, encounterId, "");

        await AssertProblem(noSpot, HttpStatusCode.BadRequest, "bad_request");
        await AssertProblem(noAnswer, HttpStatusCode.BadRequest, "bad_request");
    }

    [Fact]
    public async Task OpenApi_document_lists_the_game_endpoints()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri("/openapi/v1.json", UriKind.Relative), Token);

        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Token));
        var paths = document.RootElement.GetProperty("paths").EnumerateObject().Select(p => p.Name).ToList();
        Assert.Contains("/api/saves", paths);
        Assert.Contains("/api/save/encounters", paths);
        Assert.Contains("/api/save/encounters/{encounterId}/identification", paths);
        Assert.Contains("/api/save/naturedex", paths);
        Assert.DoesNotContain("/api/save/discoveries", paths);
    }

    private static async Task AssertProblem(HttpResponseMessage response, HttpStatusCode status, string code)
    {
        Assert.Equal(status, response.StatusCode);
        using var body = await ReadJsonAsync(response);
        Assert.Equal(code, body.RootElement.GetProperty("code").GetString());
    }
}
