using System.Net;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Time.Testing;
using Slovion.IntegrationTests.Infrastructure;
using static Slovion.IntegrationTests.Infrastructure.GameApiClient;

namespace Slovion.IntegrationTests;

[Collection(DatabaseCollectionDefinition.Name)]
public sealed class ResearchTests(PostgresFixture database)
{
    // The save is created at 08:00 in-game (morning); one real second is one in-game minute (D8).
    private static readonly TimeSpan ToEvening = TimeSpan.FromSeconds(600);      // 18:00
    private static readonly TimeSpan ToNextMorning = TimeSpan.FromSeconds(840);  // from 18:00 to day 2, 08:00

    private readonly FakeTimeProvider clock = new(new DateTimeOffset(2026, 6, 1, 8, 0, 0, TimeSpan.Zero));

    private SlovionApiFactory Factory() =>
        new(database.ConnectionString, configureServices: services => services.AddSingleton<TimeProvider>(clock));

    /// <summary>Interacts with the sage spot; the sage is already identified.</summary>
    private static async Task<JsonElement> SightSageAsync(HttpClient client, string token)
    {
        using var response = await StartEncounterAsync(client, token, SageSpot);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var body = await ReadJsonAsync(response);
        Assert.True(body.RootElement.GetProperty("alreadyIdentified").GetBoolean());
        return body.RootElement.Clone();
    }

    private static JsonElement SageEntry(JsonElement[] entries) =>
        entries.Single(entry => entry.GetProperty("speciesId").GetString() == Sage);

    [Fact]
    public async Task Sighting_the_sage_at_other_times_researches_it_and_reveals_more()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);
        await IdentifyAsync(client, token, SageSpot, Sage);

        var levelOne = SageEntry(await NatureDexEntriesAsync(client, token));
        Assert.Equal(1, levelOne.GetProperty("researchLevel").GetInt32());
        var species = levelOne.GetProperty("species");
        Assert.Equal("travniška kadulja", species.GetProperty("name").GetString());
        Assert.NotEqual(0, species.GetProperty("characteristics").GetArrayLength());
        Assert.Equal(JsonValueKind.Null, species.GetProperty("habitat").ValueKind);
        Assert.Equal(JsonValueKind.Null, species.GetProperty("distribution").ValueKind);
        Assert.Equal(JsonValueKind.Null, species.GetProperty("season").ValueKind);

        var atOnce = await SightSageAsync(client, token);
        Assert.False(atOnce.GetProperty("researched").GetBoolean());
        Assert.Equal(1, atOnce.GetProperty("entry").GetProperty("researchLevel").GetInt32());

        clock.Advance(ToEvening);
        var evening = await SightSageAsync(client, token);
        Assert.True(evening.GetProperty("researched").GetBoolean());
        Assert.Equal(2, evening.GetProperty("entry").GetProperty("researchLevel").GetInt32());
        Assert.Equal(JsonValueKind.String, evening.GetProperty("entry").GetProperty("species").GetProperty("habitat").ValueKind);
        Assert.Equal(JsonValueKind.Null, evening.GetProperty("entry").GetProperty("species").GetProperty("season").ValueKind);

        clock.Advance(ToNextMorning);
        var nextMorning = await SightSageAsync(client, token);
        Assert.True(nextMorning.GetProperty("researched").GetBoolean());
        var levelThree = SageEntry(await NatureDexEntriesAsync(client, token));
        Assert.Equal(3, levelThree.GetProperty("researchLevel").GetInt32());
        Assert.Equal(JsonValueKind.String, levelThree.GetProperty("species").GetProperty("season").ValueKind);
        Assert.True(levelThree.GetProperty("species").GetProperty("sources").GetArrayLength() >= species.GetProperty("sources").GetArrayLength());

        clock.Advance(ToEvening);
        Assert.False((await SightSageAsync(client, token)).GetProperty("researched").GetBoolean());
    }
}
