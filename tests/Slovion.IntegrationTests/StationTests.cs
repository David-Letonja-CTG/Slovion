using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Slovion.Application.Saves;
using Slovion.Domain.Content;
using Slovion.Domain.Discovery;
using Slovion.Infrastructure.Persistence;
using Slovion.IntegrationTests.Infrastructure;
using static Slovion.IntegrationTests.Infrastructure.GameApiClient;

namespace Slovion.IntegrationTests;

[Collection(DatabaseCollectionDefinition.Name)]
public sealed class StationTests(PostgresFixture database)
{
    private static CancellationToken Token => TestContext.Current.CancellationToken;

    private SlovionApiFactory Factory() => new(database.ConnectionString);

    private static async Task<(HttpStatusCode Status, JsonElement Body)> GetStationsAsync(HttpClient client, string? token)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, new Uri("/api/save/stations", UriKind.Relative));
        if (token is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }

        using var response = await client.SendAsync(request, Token);
        using var json = await ReadJsonAsync(response);
        return (response.StatusCode, json.RootElement.Clone());
    }

    [Fact]
    public async Task A_new_save_sees_every_station_with_nothing_researched()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);

        var (status, body) = await GetStationsAsync(client, token);

        Assert.Equal(HttpStatusCode.OK, status);
        var stations = body.GetProperty("stations").EnumerateArray().ToList();
        Assert.Equal(["meadow_station", "forest_station", "mammal_station", "mountain_station", "bird_station", "cave_station", "city_station"], stations.Select(station => station.GetProperty("stationId").GetString()));
        var forest = stations[1];
        Assert.Equal(
            ("Raziskovalna postaja v Kočevju", "Gozdna drevesa", "kocevje_forest", 3, 0, false),
            (forest.GetProperty("name").GetString(), forest.GetProperty("theme").GetString(), forest.GetProperty("mapId").GetString(), forest.GetProperty("goal").GetInt32(), forest.GetProperty("researched").GetInt32(), forest.GetProperty("met").GetBoolean()));
        Assert.All(forest.GetProperty("species").EnumerateArray(), species => Assert.Equal((0, JsonValueKind.Null), (species.GetProperty("level").GetInt32(), species.GetProperty("name").ValueKind)));
    }

    [Fact]
    public async Task Stations_need_a_save_token()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();

        var (status, body) = await GetStationsAsync(client, null);

        Assert.Equal(HttpStatusCode.Unauthorized, status);
        Assert.Equal("invalid_save_token", body.GetProperty("code").GetString());
    }

    [Fact]
    public async Task The_sighting_that_meets_the_meadow_station_s_goal_brings_its_certificate()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);

        // Research takes in-game time: the save is made 15 real minutes old (now is 23:00 in-game, night), with the
        // dandelion and the hawthorn fully researched and the sage researched to 2 in the evening.
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SlovionDbContext>();
            var hash = SaveToken.Hash(token);
            var slotId = (await db.SaveSlots.SingleAsync(slot => slot.TokenHash == hash, Token)).Id;
            var created = DateTimeOffset.UtcNow.AddMinutes(-15);
            await db.Database.ExecuteSqlAsync($"update save_slots set created_at = {created} where id = {slotId}", Token);
            db.Discoveries.AddRange(
                Researched(slotId, "taraxacum_officinale", "meadow_dandelion_1", created, 3),
                Researched(slotId, "crataegus_monogyna", "hedgerow_hawthorn_1", created, 3),
                Researched(slotId, Sage, SageSpot, created, 2));
            await db.SaveChangesAsync(Token);
        }

        using var sighting = await StartEncounterAsync(client, token);
        using var body = await ReadJsonAsync(sighting);

        Assert.Equal(HttpStatusCode.OK, sighting.StatusCode);
        var root = body.RootElement;
        Assert.Equal((true, 3), (root.GetProperty("researched").GetBoolean(), root.GetProperty("entry").GetProperty("researchLevel").GetInt32()));
        var certificate = Assert.Single(root.GetProperty("newCertificates").EnumerateArray());
        Assert.Equal(("meadow_station", "Raziskovalna postaja na Dravskem polju"), (certificate.GetProperty("stationId").GetString(), certificate.GetProperty("name").GetString()));
        var (_, stations) = await GetStationsAsync(client, token);
        var meadow = stations.GetProperty("stations")[0];
        Assert.Equal((3, true), (meadow.GetProperty("researched").GetInt32(), meadow.GetProperty("met").GetBoolean()));
    }

    /// <summary>A discovery identified in the save's first morning, researched in the evening (2) and at night (3).</summary>
    private static SpeciesDiscovery Researched(Guid slotId, string speciesId, string spotId, DateTimeOffset created, int level)
    {
        var id = SpeciesId.Parse(speciesId);
        var discovery = SpeciesDiscovery.Observe(slotId, Sighting.AtSpot(new MapSpot(MeadowMap, spotId, id)), created);
        discovery.Identify(created);
        if (level >= 2)
        {
            discovery.Research(created.AddSeconds(600), created); // 18:00
        }

        if (level >= 3)
        {
            discovery.Research(created.AddSeconds(840), created); // 22:00
        }

        return discovery;
    }
}
