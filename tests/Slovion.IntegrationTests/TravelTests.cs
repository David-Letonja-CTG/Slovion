using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Slovion.IntegrationTests.Infrastructure;
using static Slovion.IntegrationTests.Infrastructure.GameApiClient;

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
        Assert.Equal(["dravsko_polje", "kocevje", "pohorje", "triglav"], regions.GetProperty("regions").EnumerateArray().Select(region => region.GetProperty("regionId").GetString()));
        var meadow = Region(regions, "dravsko_polje");
        Assert.Equal(("Dravsko polje", "dravsko_polje_meadow", true), (meadow.GetProperty("name").GetString(), meadow.GetProperty("mapId").GetString(), meadow.GetProperty("unlocked").GetBoolean()));
        Assert.Equal(JsonValueKind.Null, meadow.GetProperty("lockedHint").ValueKind);
        var kocevje = Region(regions, "kocevje");
        Assert.False(kocevje.GetProperty("unlocked").GetBoolean());
        Assert.Equal("Pomagaj Veri na Dravskem polju.", kocevje.GetProperty("lockedHint").GetString());
        Assert.Equal(JsonValueKind.Null, kocevje.GetProperty("required").ValueKind);
        var pohorje = Region(regions, "pohorje");
        Assert.Equal((false, 0, 6), (pohorje.GetProperty("unlocked").GetBoolean(), pohorje.GetProperty("identified").GetInt32(), pohorje.GetProperty("required").GetInt32()));
        Assert.Equal((62, 27), (pohorje.GetProperty("x").GetInt32(), pohorje.GetProperty("y").GetInt32()));
        Assert.False(Region(regions, "triglav").GetProperty("unlocked").GetBoolean());
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
            Assert.Equal((false, 3, 6), (pohorje.GetProperty("unlocked").GetBoolean(), pohorje.GetProperty("identified").GetInt32(), pohorje.GetProperty("required").GetInt32()));

            var (status, travelled) = await SendAsync(client, token, HttpMethod.Post, "/api/save/travel", new { regionId = "kocevje" });
            Assert.Equal(HttpStatusCode.OK, status);
            Assert.Equal(("kocevje", "kocevje_forest"), (travelled.GetProperty("regionId").GetString(), travelled.GetProperty("mapId").GetString()));
        }

        await using var after = Factory();
        using var restarted = after.CreateClient();
        Assert.Equal("kocevje", (await RegionsAsync(restarted, token)).GetProperty("currentRegionId").GetString());
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
