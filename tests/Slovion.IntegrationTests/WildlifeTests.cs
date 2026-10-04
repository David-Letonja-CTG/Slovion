using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Time.Testing;
using Slovion.IntegrationTests.Infrastructure;
using static Slovion.IntegrationTests.Infrastructure.GameApiClient;

namespace Slovion.IntegrationTests;

[Collection(DatabaseCollectionDefinition.Name)]
public sealed class WildlifeTests(PostgresFixture database)
{
    private readonly FakeTimeProvider clock = new(new DateTimeOffset(2026, 6, 1, 8, 0, 0, TimeSpan.Zero));

    private static CancellationToken Token => TestContext.Current.CancellationToken;

    private SlovionApiFactory Factory() =>
        new(database.ConnectionString, configureServices: services => services.AddSingleton<TimeProvider>(clock));

    private static async Task<(HttpStatusCode Status, JsonElement Body)> WildlifeAsync(HttpClient client, string? token, string? mapId)
    {
        var query = mapId is null ? string.Empty : $"?mapId={Uri.EscapeDataString(mapId)}";
        using var request = new HttpRequestMessage(HttpMethod.Get, new Uri($"/api/save/wildlife{query}", UriKind.Relative));
        if (token is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }

        using var response = await client.SendAsync(request, Token);
        using var body = await ReadJsonAsync(response);
        return (response.StatusCode, body.RootElement.Clone());
    }

    private static Dictionary<string, (string Species, string Torch, bool Present)> Animals(JsonElement body) =>
        body.GetProperty("animals").EnumerateArray().ToDictionary(
            animal => animal.GetProperty("spotId").GetString()!,
            animal => (animal.GetProperty("speciesId").GetString()!, animal.GetProperty("torch").GetString()!, animal.GetProperty("present").GetBoolean()));

    [Fact]
    public async Task The_meadow_residents_are_present_on_a_spring_morning()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);

        var (status, body) = await WildlifeAsync(client, token, MeadowMap);

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal(
            new Dictionary<string, (string, string, bool)>
            {
                ["hedgerow_shrike_1"] = ("lanius_collurio", "shy", true),
                ["meadow_hare_1"] = ("lepus_europaeus", "curious", true),
                ["meadow_skylark_1"] = ("alauda_arvensis", "calm", true),
                ["meadow_swallowtail_1"] = ("papilio_machaon", "calm", true),
            },
            Animals(body));
    }

    [Fact]
    public async Task The_olm_is_listed_as_aquatic_and_the_bat_only_in_winter()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);

        var (status, animals) = await WildlifeAsync(client, token, "rakov_skocjan_karst");

        Assert.Equal(HttpStatusCode.OK, status);
        var byId = animals.GetProperty("animals").EnumerateArray().ToDictionary(animal => animal.GetProperty("speciesId").GetString()!);
        Assert.True(byId["proteus_anguinus"].GetProperty("aquatic").GetBoolean());
        Assert.False(byId["leptodirus_hochenwartii"].GetProperty("aquatic").GetBoolean());
        // A new save is in spring: the bat hibernates in the cave in winter only.
        Assert.False(byId["rhinolophus_ferrumequinum"].GetProperty("present").GetBoolean());
        Assert.True(byId["proteus_anguinus"].GetProperty("present").GetBoolean());
    }

    [Fact]
    public async Task The_hedgehog_comes_out_in_the_ljubljana_park_only_at_dusk_and_night()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);

        // A new save starts on a spring morning: the swift and the kingfisher are out, the hedgehog is not.
        var morning = Animals((await WildlifeAsync(client, token, "ljubljana_park")).Body);
        Assert.Equal((true, true, false), (morning["city_swift_1"].Present, morning["city_kingfisher_1"].Present, morning["city_hedgehog_1"].Present));

        clock.Advance(TimeSpan.FromMinutes(14)); // 22:00, night
        var night = Animals((await WildlifeAsync(client, token, "ljubljana_park")).Body);
        Assert.True(night["city_hedgehog_1"].Present);
    }

    [Fact]
    public async Task Residents_out_of_season_are_absent()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);
        clock.Advance(TimeSpan.FromSeconds(12960)); // day 10: winter

        var animals = Animals((await WildlifeAsync(client, token, MeadowMap)).Body);

        Assert.False(animals["meadow_swallowtail_1"].Present);
        Assert.False(animals["hedgerow_shrike_1"].Present);
        Assert.True(animals["meadow_hare_1"].Present);
        Assert.True(animals["meadow_skylark_1"].Present);
    }

    [Theory]
    [InlineData("no_such_map", HttpStatusCode.NotFound, "unknown_map")]
    [InlineData(null, HttpStatusCode.BadRequest, "bad_request")]
    public async Task Invalid_maps_are_rejected(string? mapId, HttpStatusCode expected, string code)
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);

        var (status, body) = await WildlifeAsync(client, token, mapId);

        Assert.Equal(expected, status);
        Assert.Equal(code, body.GetProperty("code").GetString());
    }

    [Fact]
    public async Task Wildlife_requires_a_save_token()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();

        var (status, body) = await WildlifeAsync(client, null, MeadowMap);

        Assert.Equal(HttpStatusCode.Unauthorized, status);
        Assert.Equal("invalid_save_token", body.GetProperty("code").GetString());
    }

    [Fact]
    public async Task OpenApi_document_lists_the_wildlife_endpoint()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri("/openapi/v1.json", UriKind.Relative), Token);
        using var body = await ReadJsonAsync(response);

        Assert.Contains("/api/save/wildlife", body.RootElement.GetProperty("paths").EnumerateObject().Select(path => path.Name));
    }
}
