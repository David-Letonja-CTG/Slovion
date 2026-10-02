using System.Net;
using System.Text.Json;
using Slovion.IntegrationTests.Infrastructure;
using static Slovion.IntegrationTests.Infrastructure.GameApiClient;

namespace Slovion.IntegrationTests;

[Collection(DatabaseCollectionDefinition.Name)]
public sealed class NatureDexTests(PostgresFixture database)
{
    private static readonly string[] MeadowSpecies = ["lepus_europaeus", "alauda_arvensis", "papilio_machaon", "taraxacum_officinale", "salvia_pratensis"];

    private static async Task<JsonElement> NatureDexAsync(HttpClient client, string token)
    {
        using var response = await GetNatureDexAsync(client, token);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var body = await ReadJsonAsync(response);
        return body.RootElement.Clone();
    }

    private static JsonElement SlotOf(JsonElement natureDex, string speciesId) =>
        NatureDexSlots(natureDex).Single(slot => slot.GetProperty("speciesId").GetString() == speciesId);

    [Fact]
    public async Task A_fresh_save_sees_every_meadow_species_as_unknown()
    {
        await using var factory = new SlovionApiFactory(database.ConnectionString);
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);

        var natureDex = await NatureDexAsync(client, token);

        var section = Assert.Single(natureDex.GetProperty("habitats").EnumerateArray());
        Assert.Equal("tall_grass", section.GetProperty("habitatId").GetString());
        Assert.Equal("Visoka trava", section.GetProperty("name").GetString());
        Assert.Equal(MeadowSpecies, section.GetProperty("species").EnumerateArray().Select(slot => slot.GetProperty("speciesId").GetString()));
        Assert.All(section.GetProperty("species").EnumerateArray(), slot =>
        {
            Assert.Equal("unknown", slot.GetProperty("status").GetString());
            Assert.Equal(JsonValueKind.Null, slot.GetProperty("entry").ValueKind);
        });
    }

    [Fact]
    public async Task Observed_species_reveal_their_group_but_not_their_name()
    {
        await using var factory = new SlovionApiFactory(database.ConnectionString);
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);
        await OpenEncounterAsync(client, token, HareSpot);

        var hare = SlotOf(await NatureDexAsync(client, token), Hare);

        Assert.Equal("observed", hare.GetProperty("status").GetString());
        var entry = hare.GetProperty("entry");
        Assert.Equal("mammal", entry.GetProperty("group").GetString());
        Assert.Equal(JsonValueKind.Null, entry.GetProperty("species").ValueKind);
    }

    [Fact]
    public async Task Identified_species_carry_their_sourced_information()
    {
        await using var factory = new SlovionApiFactory(database.ConnectionString);
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);
        await IdentifyAsync(client, token, SageSpot, Sage);

        var natureDex = await NatureDexAsync(client, token);

        var sage = SlotOf(natureDex, Sage);
        Assert.Equal("identified", sage.GetProperty("status").GetString());
        Assert.Equal("travniška kadulja", sage.GetProperty("entry").GetProperty("species").GetProperty("name").GetString());
        Assert.Equal(4, NatureDexSlots(natureDex).Count(slot => slot.GetProperty("status").GetString() == "unknown"));
    }
}
