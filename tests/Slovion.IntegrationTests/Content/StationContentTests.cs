using System.Text.Json.Nodes;
using Slovion.Domain.Content;
using Slovion.Infrastructure.Content;

namespace Slovion.IntegrationTests.Content;

public class StationContentTests
{
    [Fact]
    public void A_placed_station_loads_with_its_map()
    {
        using var content = WithStation();

        var catalog = FileContentCatalog.Load(content.Write());

        var station = catalog.FindStation("test_station");
        Assert.NotNull(station);
        Assert.Equal(("test_meadow", 1), (station.MapId, station.Goal));
        Assert.Equal([SpeciesId.Parse("salvia_pratensis")], station.Species);
        Assert.Equal(("Testna postaja", "Travniki"), (station.Text["sl"].Name, station.Text["sl"].Theme));
        Assert.Equal([station], catalog.AllStations);
    }

    public static TheoryData<string, Action<ContentFolder>, string> BrokenStations => new()
    {
        { "goal above the list", c => c.Station!["goal"] = 2, "stations/test_station.json: 'goal' must be between 1 and the number of species (1) (found 2)" },
        { "goal of zero", c => c.Station!["goal"] = 0, "'goal' must be between 1 and the number of species (1) (found 0)" },
        { "unknown species", c => c.Station!["species"] = new JsonArray("vulpes_vulpes"), "stations/test_station.json: unknown species 'vulpes_vulpes'" },
        { "repeated species", c => c.Station!["species"] = new JsonArray("salvia_pratensis", "salvia_pratensis"), "species 'salvia_pratensis' is listed more than once" },
        { "no Slovenian text", c => c.Station!["text"] = new JsonObject(), "stations/test_station.json: Slovenian text ('text.sl') is required" },
        { "no theme", c => c.Station!["text"]!["sl"]!.AsObject().Remove("theme"), "'text.sl' needs a 'name' and a 'theme'" },
        { "invalid ID", c => c.Station!["id"] = "Test Station", "invalid station ID 'Test Station'" },
        { "placed on no map", c => Objects(c).RemoveAt(Objects(c).Count - 1), "station 'test_station' must be placed on exactly one map (found 0)" },
        { "placed twice", c => Objects(c).Add(ContentFolder.TileObject("station", "stationId", "test_station", tileX: 2, tileY: 2)), "station 'test_station' must be placed on exactly one map (found 2)" },
        { "unknown station on the map", c => Objects(c).Add(ContentFolder.TileObject("station", "stationId", "lost_station", tileX: 2, tileY: 2)), "station 'lost_station' refers to unknown station 'lost_station'" },
        { "station outside the map", c => Objects(c)[^1] = ContentFolder.TileObject("station", "stationId", "test_station", tileX: 9, tileY: 0), "station 'test_station' lies outside the map" },
    };

    [Theory]
    [MemberData(nameof(BrokenStations))]
    public void Broken_stations_are_rejected_with_a_named_error(string _, Action<ContentFolder> breakIt, string expectedError)
    {
        using var content = WithStation();
        breakIt(content);

        var error = Assert.Throws<ContentValidationException>(() => FileContentCatalog.Load(content.Write()));

        Assert.Contains(error.Errors, message => message.Contains(expectedError, StringComparison.Ordinal));
    }

    [Fact]
    public void Repository_content_has_a_station_on_every_region_map()
    {
        var catalog = FileContentCatalog.Load(ContentFolder.RepositoryContent());

        Assert.Equal(
            [
                ("meadow_station", "dravsko_polje_meadow", "Travniki in mejice", 4, 3),
                ("forest_station", "kocevje_forest", "Gozdna drevesa", 3, 3),
                ("mammal_station", "pohorje_forest", "Sesalci", 7, 4),
                ("mountain_station", "triglav_alps", "Gorski svet", 4, 3),
                ("bird_station", "cerknica_lake", "Ptice", 4, 3),
                ("cave_station", "rakov_skocjan_karst", "Podzemlje", 3, 2),
                ("city_station", "ljubljana_park", "Mestna narava", 4, 3),
            ],
            catalog.AllStations.Select(station => (station.Id, station.MapId, station.Text["sl"].Theme, station.Species.Count, station.Goal)));
        Assert.Equal(catalog.AllRegions.Select(region => region.MapId), catalog.AllStations.Select(station => station.MapId));
        Assert.Equal(
            ["abies_alba", "fagus_sylvatica", "picea_abies"],
            catalog.FindStation("forest_station")!.Species.Select(id => id.Value));
    }

    /// <summary>The valid fixture plus a station listing the sage, placed on the test map at (1, 1).</summary>
    private static ContentFolder WithStation()
    {
        var content = new ContentFolder
        {
            Station = new JsonObject
            {
                ["id"] = "test_station",
                ["species"] = new JsonArray("salvia_pratensis"),
                ["goal"] = 1,
                ["text"] = new JsonObject { ["sl"] = new JsonObject { ["name"] = "Testna postaja", ["theme"] = "Travniki" } },
            },
        };
        Objects(content).Add(ContentFolder.TileObject("station", "stationId", "test_station", tileX: 1, tileY: 1));
        return content;
    }

    private static JsonArray Objects(ContentFolder content) => content.Map["layers"]![2]!["objects"]!.AsArray();
}
