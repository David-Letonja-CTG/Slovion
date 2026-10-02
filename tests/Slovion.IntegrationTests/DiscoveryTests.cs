using System.Net;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Time.Testing;
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

    [Fact]
    public async Task First_discovery_returns_201_with_server_time_and_the_entry()
    {
        await using var factory = Factory(new FakeTimeProvider(June1));
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);

        using var response = await DiscoverAsync(client, token);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        using var body = await ReadJsonAsync(response);
        var root = body.RootElement;
        Assert.Equal("salvia_pratensis", root.GetProperty("speciesId").GetString());
        Assert.True(root.GetProperty("isNew").GetBoolean());
        Assert.Equal("2026-06-01T10:00:00Z", root.GetProperty("discoveredAt").GetString());
        Assert.Equal("travniška kadulja", root.GetProperty("species").GetProperty("name").GetString());
    }

    [Fact]
    public async Task Repeat_discovery_returns_200_with_the_original_time()
    {
        var time = new FakeTimeProvider(June1);
        await using var factory = Factory(time);
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);
        using var first = await DiscoverAsync(client, token);
        time.Advance(TimeSpan.FromHours(2));

        using var again = await DiscoverAsync(client, token);

        Assert.Equal(HttpStatusCode.OK, again.StatusCode);
        using var body = await ReadJsonAsync(again);
        Assert.False(body.RootElement.GetProperty("isNew").GetBoolean());
        Assert.Equal("2026-06-01T10:00:00Z", body.RootElement.GetProperty("discoveredAt").GetString());
    }

    [Fact]
    public async Task Concurrent_duplicates_store_exactly_one_discovery()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);

        var responses = await Task.WhenAll(DiscoverAsync(client, token), DiscoverAsync(client, token));

        Assert.Equal(
            [HttpStatusCode.OK, HttpStatusCode.Created],
            responses.Select(r => r.StatusCode).Order());
        using var dex = await GetNatureDexAsync(client, token);
        using var body = await ReadJsonAsync(dex);
        Assert.Equal(1, body.RootElement.GetProperty("entries").GetArrayLength());
        foreach (var response in responses)
        {
            response.Dispose();
        }
    }

    [Theory]
    [InlineData(MeadowMap, "does_not_exist")]
    [InlineData("no_such_map", SageSpot)]
    public async Task Unknown_spot_returns_404_and_records_nothing(string mapId, string spotId)
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);

        using var response = await DiscoverAsync(client, token, mapId, spotId);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        using var body = await ReadJsonAsync(response);
        Assert.Equal("unknown_spot", body.RootElement.GetProperty("code").GetString());
        using var dex = await GetNatureDexAsync(client, token);
        using var dexBody = await ReadJsonAsync(dex);
        Assert.Equal(0, dexBody.RootElement.GetProperty("entries").GetArrayLength());
    }

    [Fact]
    public async Task Request_without_map_or_spot_is_a_bad_request()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);

        using var response = await DiscoverAsync(client, token, mapId: "", spotId: SageSpot);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var body = await ReadJsonAsync(response);
        Assert.Equal("bad_request", body.RootElement.GetProperty("code").GetString());
    }

    [Fact]
    public async Task Discoveries_survive_an_api_restart()
    {
        string token;
        await using (var before = Factory())
        {
            using var client = before.CreateClient();
            token = await CreateSaveAsync(client);
            using var _ = await DiscoverAsync(client, token);
        }

        await using var after = Factory();
        using var restarted = after.CreateClient();
        using var dex = await GetNatureDexAsync(restarted, token);

        using var body = await ReadJsonAsync(dex);
        var entry = Assert.Single(body.RootElement.GetProperty("entries").EnumerateArray());
        Assert.Equal("salvia_pratensis", entry.GetProperty("speciesId").GetString());
    }

    [Fact]
    public async Task NatureDex_entry_contains_sourced_slovenian_information()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);
        using var _ = await DiscoverAsync(client, token);

        using var dex = await GetNatureDexAsync(client, token);

        Assert.Equal(HttpStatusCode.OK, dex.StatusCode);
        using var body = await ReadJsonAsync(dex);
        var species = Assert.Single(body.RootElement.GetProperty("entries").EnumerateArray()).GetProperty("species");
        Assert.Equal("travniška kadulja", species.GetProperty("name").GetString());
        Assert.Equal("Salvia pratensis L.", species.GetProperty("scientificName").GetString());
        Assert.Equal("ustnatice (Lamiaceae)", species.GetProperty("family").GetString());
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
        using var _ = await DiscoverAsync(client, token);

        using var dex = await GetNatureDexAsync(client, token, acceptLanguage);

        Assert.Equal(["sl"], dex.Content.Headers.ContentLanguage);
        using var body = await ReadJsonAsync(dex);
        var entry = Assert.Single(body.RootElement.GetProperty("entries").EnumerateArray());
        Assert.Equal("travniška kadulja", entry.GetProperty("species").GetProperty("name").GetString());
    }

    [Fact]
    public async Task OpenApi_document_lists_the_game_endpoints()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri("/openapi/v1.json", UriKind.Relative), TestContext.Current.CancellationToken);

        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var paths = document.RootElement.GetProperty("paths").EnumerateObject().Select(p => p.Name).ToList();
        Assert.Contains("/api/saves", paths);
        Assert.Contains("/api/save/discoveries", paths);
        Assert.Contains("/api/save/naturedex", paths);
    }
}
