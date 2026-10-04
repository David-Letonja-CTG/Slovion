using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Slovion.Application.Saves;
using Slovion.Domain.Quests;
using Slovion.Infrastructure.Persistence;
using Slovion.IntegrationTests.Infrastructure;
using static Slovion.IntegrationTests.Infrastructure.GameApiClient;
using GameApi = Slovion.IntegrationTests.Infrastructure.GameApiClient;

namespace Slovion.IntegrationTests;

[Collection(DatabaseCollectionDefinition.Name)]
public sealed class TravelTests(PostgresFixture database)
{
    private static CancellationToken Token => TestContext.Current.CancellationToken;

    private SlovionApiFactory Factory() => new(database.ConnectionString);

    private static async Task<(HttpStatusCode Status, JsonElement Body)> SendAsync(HttpClient client, string? token, HttpMethod method, string path, object? body = null)
    {
        using var request = new HttpRequestMessage(method, new Uri(path, UriKind.Relative)) { Content = body is null ? null : JsonContent.Create(body) };
        if (token is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }

        using var response = await client.SendAsync(request, Token);
        using var json = await ReadJsonAsync(response);
        return (response.StatusCode, json.RootElement.Clone());
    }

    private static async Task<JsonElement> RegionsAsync(HttpClient client, string token)
    {
        var (status, body) = await SendAsync(client, token, HttpMethod.Get, "/api/save/regions");
        Assert.Equal(HttpStatusCode.OK, status);
        return body;
    }

    private static JsonElement Region(JsonElement regions, string id) =>
        regions.GetProperty("regions").EnumerateArray().Single(region => region.GetProperty("regionId").GetString() == id);

    /// <summary>Observes and correctly identifies the species at a spot of any map.</summary>
    private static async Task IdentifyOnMapAsync(HttpClient client, string token, string spotId, string speciesId, string mapId)
    {
        using var started = await GameApi.StartEncounterAsync(client, token, spotId, mapId);
        Assert.Equal(HttpStatusCode.Created, started.StatusCode);
        using var body = await ReadJsonAsync(started);
        using var answer = await AnswerAsync(client, token, body.RootElement.GetProperty("encounterId").GetGuid(), speciesId);
        answer.EnsureSuccessStatusCode();
    }

    /// <summary>Identifies three species and completes Vera's quest, which earns the flag that opens Kočevje.</summary>
    private static async Task CompleteVerasQuestAsync(HttpClient client, string token)
    {
        await SendAsync(client, token, HttpMethod.Post, "/api/save/conversations", new { mapId = MeadowMap, npcId = "vera" });
        await IdentifyAsync(client, token, SageSpot, Sage);
        await IdentifyAsync(client, token, "meadow_dandelion_1", "taraxacum_officinale");
        await IdentifyAsync(client, token, HareSpot, Hare);
        await SendAsync(client, token, HttpMethod.Post, "/api/save/conversations", new { mapId = MeadowMap, npcId = "vera" });
    }

    [Fact]
    public async Task A_new_save_starts_on_dravsko_polje_with_the_other_regions_locked()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);

        var regions = await RegionsAsync(client, token);

        Assert.Equal("dravsko_polje", regions.GetProperty("currentRegionId").GetString());
        Assert.Equal(["dravsko_polje", "kocevje", "pohorje", "triglav", "cerknica", "rakov_skocjan"], regions.GetProperty("regions").EnumerateArray().Select(region => region.GetProperty("regionId").GetString()));
        var meadow = Region(regions, "dravsko_polje");
        Assert.Equal(("Dravsko polje", "dravsko_polje_meadow", true), (meadow.GetProperty("name").GetString(), meadow.GetProperty("mapId").GetString(), meadow.GetProperty("unlocked").GetBoolean()));
        Assert.Equal(JsonValueKind.Null, meadow.GetProperty("lockedHint").ValueKind);
        var kocevje = Region(regions, "kocevje");
        Assert.False(kocevje.GetProperty("unlocked").GetBoolean());
        Assert.Equal("Pomagaj Veri na Dravskem polju.", kocevje.GetProperty("lockedHint").GetString());
        Assert.Equal(JsonValueKind.Null, kocevje.GetProperty("required").ValueKind);
        var pohorje = Region(regions, "pohorje");
        Assert.Equal((false, "Pomagaj Juretu v Kočevju."), (pohorje.GetProperty("unlocked").GetBoolean(), pohorje.GetProperty("lockedHint").GetString()));
        Assert.Equal(JsonValueKind.Null, pohorje.GetProperty("required").ValueKind);
        Assert.Equal((62, 27), (pohorje.GetProperty("x").GetInt32(), pohorje.GetProperty("y").GetInt32()));
        Assert.False(Region(regions, "triglav").GetProperty("unlocked").GetBoolean());
        Assert.Equal((false, "Pomagaj Neži ob Cerkniškem jezeru."), (Region(regions, "rakov_skocjan").GetProperty("unlocked").GetBoolean(), Region(regions, "rakov_skocjan").GetProperty("lockedHint").GetString()));
        var lake = Region(regions, "cerknica");
        Assert.Equal((false, "Pomagaj Luki na Triglavu.", "cerknica_lake"), (lake.GetProperty("unlocked").GetBoolean(), lake.GetProperty("lockedHint").GetString(), lake.GetProperty("mapId").GetString()));
    }

    [Fact]
    public async Task Nezas_quest_opens_rakov_skocjan()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);

        // The journey before Neža is covered elsewhere; here her completed quest is stored directly.
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SlovionDbContext>();
            var hash = SaveToken.Hash(token);
            var slotId = (await db.SaveSlots.SingleAsync(slot => slot.TokenHash == hash, Token)).Id;
            var neza = QuestProgress.Start(slotId, "vanishing_lake", DateTimeOffset.UtcNow);
            neza.Complete(DateTimeOffset.UtcNow);
            db.QuestProgress.Add(neza);
            await db.SaveChangesAsync(Token);
        }

        Assert.True(Region(await RegionsAsync(client, token), "rakov_skocjan").GetProperty("unlocked").GetBoolean());
        var (status, travelled) = await SendAsync(client, token, HttpMethod.Post, "/api/save/travel", new { regionId = "rakov_skocjan" });
        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal("rakov_skocjan_karst", travelled.GetProperty("mapId").GetString());
    }

    [Fact]
    public async Task Lukas_quest_opens_the_lake_and_travelling_there_works()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);

        // The journey before Luka is covered elsewhere; here his completed quest is stored directly.
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SlovionDbContext>();
            var hash = SaveToken.Hash(token);
            var slotId = (await db.SaveSlots.SingleAsync(slot => slot.TokenHash == hash, Token)).Id;
            var luka = QuestProgress.Start(slotId, "below_the_peaks", DateTimeOffset.UtcNow);
            luka.Complete(DateTimeOffset.UtcNow);
            db.QuestProgress.Add(luka);
            await db.SaveChangesAsync(Token);
        }

        Assert.True(Region(await RegionsAsync(client, token), "cerknica").GetProperty("unlocked").GetBoolean());
        var (status, travelled) = await SendAsync(client, token, HttpMethod.Post, "/api/save/travel", new { regionId = "cerknica" });
        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal(("cerknica", "cerknica_lake"), (travelled.GetProperty("regionId").GetString(), travelled.GetProperty("mapId").GetString()));
    }

    [Fact]
    public async Task After_Veras_quest_kocevje_opens_and_travelling_there_survives_a_restart()
    {
        string token;
        await using (var before = Factory())
        {
            using var client = before.CreateClient();
            token = await CreateSaveAsync(client);
            await CompleteVerasQuestAsync(client, token);

            var regions = await RegionsAsync(client, token);
            Assert.True(Region(regions, "kocevje").GetProperty("unlocked").GetBoolean());
            var pohorje = Region(regions, "pohorje");
            Assert.Equal((false, "Pomagaj Juretu v Kočevju."), (pohorje.GetProperty("unlocked").GetBoolean(), pohorje.GetProperty("lockedHint").GetString()));

            var (status, travelled) = await SendAsync(client, token, HttpMethod.Post, "/api/save/travel", new { regionId = "kocevje" });
            Assert.Equal(HttpStatusCode.OK, status);
            Assert.Equal(("kocevje", "kocevje_forest"), (travelled.GetProperty("regionId").GetString(), travelled.GetProperty("mapId").GetString()));
        }

        await using var after = Factory();
        using var restarted = after.CreateClient();
        Assert.Equal("kocevje", (await RegionsAsync(restarted, token)).GetProperty("currentRegionId").GetString());
    }

    [Fact]
    public async Task Only_the_region_s_species_count_for_Jure_and_his_quest_opens_pohorje()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);
        await CompleteVerasQuestAsync(client, token);
        await IdentifyOnMapAsync(client, token, "meadow_skylark_1", "alauda_arvensis", "dravsko_polje_meadow");
        await IdentifyOnMapAsync(client, token, "meadow_swallowtail_1", "papilio_machaon", "dravsko_polje_meadow");
        await IdentifyOnMapAsync(client, token, "kocevje_garlic_1", "allium_ursinum", "kocevje_forest");

        var (_, offer) = await SendAsync(client, token, HttpMethod.Post, "/api/save/conversations", new { mapId = "kocevje_forest", npcId = "jure" });
        Assert.Equal("Jure", offer.GetProperty("npcName").GetString());
        var quest = offer.GetProperty("quest");
        Assert.Equal(("in_the_shade_of_firs", "active", 1, 3), (quest.GetProperty("questId").GetString(), quest.GetProperty("status").GetString(), quest.GetProperty("progress").GetInt32(), quest.GetProperty("goal").GetInt32()));

        await IdentifyOnMapAsync(client, token, "kocevje_woodruff_1", "galium_odoratum", "kocevje_forest");
        await IdentifyOnMapAsync(client, token, "kocevje_bear_1", "ursus_arctos", "kocevje_forest");
        var (_, ready) = await SendAsync(client, token, HttpMethod.Post, "/api/save/conversations", new { mapId = "kocevje_forest", npcId = "jure" });

        Assert.Equal("completed", ready.GetProperty("quest").GetProperty("status").GetString());
        Assert.Contains("pohorje_open", ready.GetProperty("flags").EnumerateArray().Select(flag => flag.GetString()));
        var regions = await RegionsAsync(client, token);
        Assert.True(Region(regions, "pohorje").GetProperty("unlocked").GetBoolean());
        Assert.Equal((false, "Pomagaj Maji na Pohorju."), (Region(regions, "triglav").GetProperty("unlocked").GetBoolean(), Region(regions, "triglav").GetProperty("lockedHint").GetString()));
    }

    [Theory]
    [InlineData("triglav", HttpStatusCode.Conflict, "region_locked")]
    [InlineData("atlantis", HttpStatusCode.NotFound, "unknown_region")]
    [InlineData(" ", HttpStatusCode.BadRequest, "bad_request")]
    [InlineData(null, HttpStatusCode.BadRequest, "bad_request")]
    public async Task Refused_travel_keeps_the_current_region(string? regionId, HttpStatusCode expected, string code)
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);

        var (status, body) = await SendAsync(client, token, HttpMethod.Post, "/api/save/travel", new { regionId });

        Assert.Equal(expected, status);
        Assert.Equal(code, body.GetProperty("code").GetString());
        Assert.Equal("dravsko_polje", (await RegionsAsync(client, token)).GetProperty("currentRegionId").GetString());
    }

    [Fact]
    public async Task Regions_and_travel_need_a_save_token()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();

        var (listStatus, listBody) = await SendAsync(client, null, HttpMethod.Get, "/api/save/regions");
        var (travelStatus, travelBody) = await SendAsync(client, "not-a-token", HttpMethod.Post, "/api/save/travel", new { regionId = "kocevje" });

        Assert.Equal((HttpStatusCode.Unauthorized, "invalid_save_token"), (listStatus, listBody.GetProperty("code").GetString()));
        Assert.Equal((HttpStatusCode.Unauthorized, "invalid_save_token"), (travelStatus, travelBody.GetProperty("code").GetString()));
    }
}
