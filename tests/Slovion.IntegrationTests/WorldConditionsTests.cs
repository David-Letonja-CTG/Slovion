using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Time.Testing;
using Slovion.Application.Discovery;
using Slovion.IntegrationTests.Infrastructure;
using static Slovion.IntegrationTests.Infrastructure.GameApiClient;

namespace Slovion.IntegrationTests;

[Collection(DatabaseCollectionDefinition.Name)]
public sealed class WorldConditionsTests(PostgresFixture database)
{
    private const string DandelionSpot = "meadow_dandelion_1";

    // Real seconds after the save's creation (one real second is one in-game minute).
    private static readonly TimeSpan Summer = TimeSpan.FromSeconds(3840);       // day 4, 00:00
    private static readonly TimeSpan WinterNight = TimeSpan.FromSeconds(12960 + 840); // day 10, 22:00

    private readonly FakeTimeProvider clock = new(new DateTimeOffset(2026, 6, 1, 8, 0, 0, TimeSpan.Zero));

    private static CancellationToken Token => TestContext.Current.CancellationToken;

    private SlovionApiFactory Factory(params int[] rolls) =>
        new(database.ConnectionString, configureServices: services =>
        {
            services.AddSingleton<TimeProvider>(clock);
            services.AddSingleton<IRandomSource>(new ScriptedRandomSource(rolls));
        });

    private static async Task<JsonElement> TimeAsync(HttpClient client, string? token, HttpStatusCode expected = HttpStatusCode.OK)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, new Uri("/api/save/time", UriKind.Relative));
        if (token is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }

        using var response = await client.SendAsync(request, Token);
        Assert.Equal(expected, response.StatusCode);
        using var body = await ReadJsonAsync(response);
        return body.RootElement.Clone();
    }

    private static void AssertTime(JsonElement time, long minutes, long day, string season, string timeOfDay)
    {
        Assert.Equal(
            (minutes, day, season, timeOfDay, 1),
            (time.GetProperty("minutes").GetInt64(), time.GetProperty("day").GetInt64(), time.GetProperty("season").GetString(), time.GetProperty("timeOfDay").GetString(), time.GetProperty("gameMinutesPerSecond").GetInt32()));
    }

    [Fact]
    public async Task A_new_save_starts_on_a_spring_morning_and_time_moves_on()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);

        AssertTime(await TimeAsync(client, token), 480, 1, "spring", "morning");

        clock.Advance(TimeSpan.FromSeconds(600));
        AssertTime(await TimeAsync(client, token), 1080, 1, "spring", "evening");

        clock.Advance(Summer - TimeSpan.FromSeconds(600) + TimeSpan.FromSeconds(480));
        AssertTime(await TimeAsync(client, token), 4800, 4, "summer", "morning");
    }

    [Fact]
    public async Task A_spot_out_of_season_finds_nothing_and_records_nothing()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);
        clock.Advance(Summer);

        using var response = await StartEncounterAsync(client, token, DandelionSpot);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var body = await ReadJsonAsync(response);
        Assert.False(body.RootElement.GetProperty("found").GetBoolean());
        Assert.Empty(await NatureDexEntriesAsync(client, token));
    }

    [Fact]
    public async Task The_same_spot_opens_in_spring()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);

        using var response = await StartEncounterAsync(client, token, DandelionSpot);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task A_winter_night_search_in_tall_grass_finds_only_species_around_in_winter()
    {
        // The roll succeeds (0) and picks the first available species by weight (0): with the swallowtail, the
        // dandelion and the sage gone in winter, the tall grass offers only the hare and the skylark.
        await using var factory = Factory(0, 0);
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);
        clock.Advance(WinterNight);

        using var request = new HttpRequestMessage(HttpMethod.Post, new Uri("/api/save/searches", UriKind.Relative))
        {
            Content = System.Net.Http.Json.JsonContent.Create(new { mapId = MeadowMap, x = 12, y = 12 }),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        using var response = await client.SendAsync(request, Token);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        using var body = await ReadJsonAsync(response);
        Assert.Equal("mammal", body.RootElement.GetProperty("group").GetString());
        AssertTime(await TimeAsync(client, token), 480 + 12960 + 840, 10, "winter", "night");
    }

    [Fact]
    public async Task Time_requires_a_save_token()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();

        var body = await TimeAsync(client, null, HttpStatusCode.Unauthorized);

        Assert.Equal("invalid_save_token", body.GetProperty("code").GetString());
    }

    [Fact]
    public async Task OpenApi_document_lists_the_time_endpoint()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri("/openapi/v1.json", UriKind.Relative), Token);
        using var body = await ReadJsonAsync(response);

        Assert.Contains("/api/save/time", body.RootElement.GetProperty("paths").EnumerateObject().Select(path => path.Name));
    }
}
