using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using Slovion.IntegrationTests.Infrastructure;
using static Slovion.IntegrationTests.Infrastructure.GameApiClient;

namespace Slovion.IntegrationTests;

/// <summary>GET /api/save/maps/{mapId}: the save's map, generated from its world seed for natural regions (D13).</summary>
[Collection(DatabaseCollectionDefinition.Name)]
public sealed class MapTests(PostgresFixture database)
{
    private static CancellationToken Token => TestContext.Current.CancellationToken;

    private static async Task<HttpResponseMessage> GetMapAsync(HttpClient client, string? token, string mapId, string? entityTag = null)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, new Uri($"/api/save/maps/{mapId}", UriKind.Relative));
        if (token is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }

        if (entityTag is not null)
        {
            request.Headers.IfNoneMatch.Add(EntityTagHeaderValue.Parse(entityTag));
        }

        return await client.SendAsync(request, Token);
    }

    private static async Task<JsonElement> LayerAsync(HttpResponseMessage response, string name)
    {
        using var map = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Token));
        return map.RootElement.GetProperty("layers").EnumerateArray().First(layer => layer.GetProperty("name").GetString() == name).Clone();
    }

    [Fact]
    public async Task A_save_gets_its_map_with_an_entity_tag_and_the_same_map_again()
    {
        await using var factory = new SlovionApiFactory(database.ConnectionString);
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);

        using var first = await GetMapAsync(client, token, "kocevje_forest");
        var tag = first.Headers.ETag?.ToString();
        using var again = await GetMapAsync(client, token, "kocevje_forest");
        using var unchanged = await GetMapAsync(client, token, "kocevje_forest", tag);

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal("application/json", first.Content.Headers.ContentType?.MediaType);
        Assert.NotNull(tag);
        Assert.Equal(tag, again.Headers.ETag?.ToString());
        Assert.Equal(HttpStatusCode.NotModified, unchanged.StatusCode);
        Assert.Contains("seed=", first.Headers.GetValues("X-World").Single(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task Two_saves_get_two_forests_with_the_same_authored_strip()
    {
        await using var factory = new SlovionApiFactory(database.ConnectionString);
        using var client = factory.CreateClient();

        using var one = await GetMapAsync(client, await CreateSaveAsync(client), "kocevje_forest");
        using var two = await GetMapAsync(client, await CreateSaveAsync(client), "kocevje_forest");
        var groundOne = (await LayerAsync(one, "ground")).GetProperty("data").EnumerateArray().Select(tile => tile.GetInt32()).ToList();
        var groundTwo = (await LayerAsync(two, "ground")).GetProperty("data").EnumerateArray().Select(tile => tile.GetInt32()).ToList();

        Assert.NotEqual(one.Headers.ETag?.ToString(), two.Headers.ETag?.ToString());
        Assert.NotEqual(groundOne, groundTwo);
        // Columns 0–7 (spawn, signpost, Jure, station) are authored and the same for every save.
        Assert.Equal(
            groundOne.Where((_, i) => i % 26 < 8),
            groundTwo.Where((_, i) => i % 26 < 8));
    }

    [Fact]
    public async Task An_authored_map_is_the_same_for_every_save_and_its_tileset_is_addressed_absolutely()
    {
        await using var factory = new SlovionApiFactory(database.ConnectionString);
        using var client = factory.CreateClient();

        using var one = await GetMapAsync(client, await CreateSaveAsync(client), "ljubljana_park");
        using var two = await GetMapAsync(client, await CreateSaveAsync(client), "ljubljana_park");
        using var map = JsonDocument.Parse(await one.Content.ReadAsStringAsync(Token));

        Assert.Equal(one.Headers.ETag?.ToString(), two.Headers.ETag?.ToString());
        Assert.False(one.Headers.Contains("X-World"));
        Assert.Equal("/content/tilesets/meadow.png", map.RootElement.GetProperty("tilesets")[0].GetProperty("image").GetString());
    }

    [Fact]
    public async Task Unknown_maps_and_missing_tokens_are_rejected()
    {
        await using var factory = new SlovionApiFactory(database.ConnectionString);
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);

        using var unknown = await GetMapAsync(client, token, "nowhere");
        using var anonymous = await GetMapAsync(client, null, "kocevje_forest");

        Assert.Equal(HttpStatusCode.NotFound, unknown.StatusCode);
        using (var body = await ReadJsonAsync(unknown))
        {
            Assert.Equal("unknown_map", body.RootElement.GetProperty("code").GetString());
        }

        Assert.Equal(HttpStatusCode.Unauthorized, anonymous.StatusCode);
    }
}
