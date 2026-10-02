using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Slovion.Application.Discovery;
using Slovion.Application.Saves;
using Slovion.Infrastructure.Persistence;
using Slovion.IntegrationTests.Infrastructure;
using static Slovion.IntegrationTests.Infrastructure.GameApiClient;

namespace Slovion.IntegrationTests;

/// <summary>Returns the scripted values first, then 0, so search outcomes are exact.</summary>
internal sealed class ScriptedRandomSource(params int[] values) : IRandomSource
{
    private readonly Queue<int> queue = new(values);

    public int NextIndex(int maxExclusive) => queue.Count > 0 ? queue.Dequeue() : 0;
}

[Collection(DatabaseCollectionDefinition.Name)]
public sealed class SearchTests(PostgresFixture database)
{
    // Tile (12, 12) lies in the south tall-grass zone of the meadow; (10, 10) is the spawn on the path.
    private const int GrassX = 12;
    private const int GrassY = 12;

    private static CancellationToken Token => TestContext.Current.CancellationToken;

    private SlovionApiFactory Factory(params int[] rolls) =>
        new(database.ConnectionString, configureServices: services => services.AddSingleton<IRandomSource>(new ScriptedRandomSource(rolls)));

    private static Task<HttpResponseMessage> SearchAsync(HttpClient client, string? token, object body)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, new Uri("/api/save/searches", UriKind.Relative)) { Content = JsonContent.Create(body) };
        if (token is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }

        return client.SendAsync(request, Token);
    }

    private static Task<HttpResponseMessage> SearchGrassAsync(HttpClient client, string token) =>
        SearchAsync(client, token, new { mapId = MeadowMap, x = GrassX, y = GrassY });

    [Fact]
    public async Task A_found_species_opens_an_encounter_and_records_where_it_was_seen()
    {
        await using var factory = Factory(0, 0); // found; first weight bucket → poljski zajec
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);

        using var response = await SearchGrassAsync(client, token);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        using var body = await ReadJsonAsync(response);
        Assert.Equal("mammal", body.RootElement.GetProperty("group").GetString());
        Assert.Equal(4, body.RootElement.GetProperty("candidates").GetArrayLength());
        Assert.Equal("observed", Assert.Single(await NatureDexEntriesAsync(client, token)).GetProperty("status").GetString());

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<SlovionDbContext>();
        var hash = SaveToken.Hash(token);
        var slotId = (await db.SaveSlots.SingleAsync(slot => slot.TokenHash == hash, Token)).Id;
        var observation = await db.Discoveries.SingleAsync(d => d.SaveSlotId == slotId, Token);
        var encounter = await db.Encounters.SingleAsync(e => e.SaveSlotId == slotId, Token);
        Assert.Equal((null, "tall_grass"), (observation.SpotId, observation.HabitatId));
        Assert.Equal((null, "tall_grass"), (encounter.SpotId, encounter.HabitatId));
    }

    [Fact]
    public async Task A_found_encounter_can_be_answered()
    {
        await using var factory = Factory(0, 0);
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);
        using var search = await SearchGrassAsync(client, token);
        using var body = await ReadJsonAsync(search);

        using var answer = await AnswerAsync(client, token, body.RootElement.GetProperty("encounterId").GetGuid(), Hare);

        using var result = await ReadJsonAsync(answer);
        Assert.True(result.RootElement.GetProperty("correct").GetBoolean());
    }

    [Fact]
    public async Task A_roll_above_the_chance_finds_nothing()
    {
        await using var factory = Factory(99);
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);

        using var response = await SearchGrassAsync(client, token);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var body = await ReadJsonAsync(response);
        Assert.False(body.RootElement.GetProperty("found").GetBoolean());
        Assert.Empty(await NatureDexEntriesAsync(client, token));
    }

    [Fact]
    public async Task Finding_an_identified_species_says_so()
    {
        await using var factory = Factory(0, 0);
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);
        await IdentifyAsync(client, token, HareSpot, Hare);

        using var response = await SearchGrassAsync(client, token);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var body = await ReadJsonAsync(response);
        Assert.True(body.RootElement.GetProperty("alreadyIdentified").GetBoolean());
        Assert.Equal("poljski zajec", body.RootElement.GetProperty("entry").GetProperty("species").GetProperty("name").GetString());
    }

    [Theory]
    [InlineData("dravsko_polje_meadow", 10, 10)] // the path
    [InlineData("no_such_map", GrassX, GrassY)]
    public async Task Searching_outside_a_habitat_is_unknown(string mapId, int x, int y)
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);

        using var response = await SearchAsync(client, token, new { mapId, x, y });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        using var body = await ReadJsonAsync(response);
        Assert.Equal("unknown_habitat", body.RootElement.GetProperty("code").GetString());
    }

    [Fact]
    public async Task A_search_without_a_tile_is_a_bad_request()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);

        using var response = await SearchAsync(client, token, new { mapId = MeadowMap, x = GrassX });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var body = await ReadJsonAsync(response);
        Assert.Equal("bad_request", body.RootElement.GetProperty("code").GetString());
    }

    [Fact]
    public async Task A_search_without_a_save_is_rejected()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();

        using var response = await SearchAsync(client, token: null, new { mapId = MeadowMap, x = GrassX, y = GrassY });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task OpenApi_document_lists_the_search_endpoint()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri("/openapi/v1.json", UriKind.Relative), Token);

        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Token));
        Assert.Contains("/api/save/searches", document.RootElement.GetProperty("paths").EnumerateObject().Select(p => p.Name));
    }
}
