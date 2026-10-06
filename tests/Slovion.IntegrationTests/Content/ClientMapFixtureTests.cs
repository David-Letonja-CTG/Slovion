using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using Slovion.Domain.Saves;
using Slovion.Infrastructure.Content;

namespace Slovion.IntegrationTests.Content;

/// <summary>
/// The client's engine tests parse generated maps (D13) from <c>client/src/engine/testing/maps/</c>: the server's output
/// for world seed 1. This test keeps them current; after a content or generator change, rewrite them with
/// <c>SLOVION_UPDATE_FIXTURES=1 dotnet test --project tests/Slovion.IntegrationTests</c>.
/// </summary>
public sealed class ClientMapFixtureTests
{
    public const long Seed = 1;

    private static readonly JsonSerializerOptions Pretty = new() { WriteIndented = true, IndentSize = 1, Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };

    [Theory]
    [InlineData("dravsko_polje_meadow")]
    [InlineData("kocevje_forest")]
    [InlineData("pohorje_forest")]
    [InlineData("triglav_alps")]
    [InlineData("cerknica_lake")]
    [InlineData("rakov_skocjan_karst")]
    public void The_client_fixtures_are_the_server_s_maps_for_seed_1(string mapId)
    {
        var content = ContentFolder.RepositoryContent();
        var fixture = Path.Combine(Directory.GetParent(content)!.FullName, "client", "src", "engine", "testing", "maps", $"{mapId}.json");
        var map = new WorldMaps(FileContentCatalog.Load(content)).Find(SaveSlot.Create(Guid.NewGuid(), [1], DateTimeOffset.UnixEpoch, Seed), mapId)!;
        var generated = JsonNode.Parse(map.Json.Span)!;

        if (Environment.GetEnvironmentVariable("SLOVION_UPDATE_FIXTURES") == "1")
        {
            Directory.CreateDirectory(Path.GetDirectoryName(fixture)!);
            File.WriteAllText(fixture, generated.ToJsonString(Pretty).ReplaceLineEndings("\n") + "\n");
        }

        Assert.True(File.Exists(fixture), $"{fixture} is missing; write it with SLOVION_UPDATE_FIXTURES=1.");
        Assert.True(
            JsonNode.DeepEquals(generated, JsonNode.Parse(File.ReadAllText(fixture))),
            $"{fixture} is out of date; rewrite it with SLOVION_UPDATE_FIXTURES=1 dotnet test --project tests/Slovion.IntegrationTests.");
    }
}
