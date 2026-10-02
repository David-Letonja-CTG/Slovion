using Slovion.Application.Content;
using Slovion.Application.Discovery;
using Slovion.Domain.Content;
using Slovion.Domain.Discovery;

namespace Slovion.Application.Tests.Discovery;

internal sealed class InMemoryDiscoveryRepository : IDiscoveryRepository
{
    private readonly List<SpeciesDiscovery> stored = [];

    public Task<(SpeciesDiscovery Stored, bool Added)> AddIfAbsentAsync(SpeciesDiscovery discovery, CancellationToken cancellationToken)
    {
        var existing = stored.SingleOrDefault(d => d.SaveSlotId == discovery.SaveSlotId && d.SpeciesId == discovery.SpeciesId);
        if (existing is not null)
        {
            return Task.FromResult((existing, false));
        }

        stored.Add(discovery);
        return Task.FromResult((discovery, true));
    }

    public Task<IReadOnlyList<SpeciesDiscovery>> ListAsync(Guid saveSlotId, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<SpeciesDiscovery>>(stored.Where(d => d.SaveSlotId == saveSlotId).ToList());
}

internal sealed class FakeContentCatalog(params Species[] species) : IContentCatalog
{
    public const string MapId = "test_meadow";

    public IReadOnlySet<string> Languages { get; } = new HashSet<string> { "sl", "en" };

    public Species? FindSpecies(SpeciesId id) => species.FirstOrDefault(s => s.Id == id);

    /// <summary>Every species has a spot named after it on <see cref="MapId"/>.</summary>
    public MapSpot? FindSpot(string mapId, string spotId) =>
        mapId == MapId && species.FirstOrDefault(s => s.Id.Value == spotId) is { } match
            ? new MapSpot(mapId, spotId, match.Id)
            : null;

    public static Species Species(string id, string slName, string? enName = null)
    {
        static Fact F(string value) => new(value, ["src"]);
        static SpeciesText Text(string name) => new(F(name), F("family"), F("habitat"), F("distribution"), F("season"), [F("trait")]);

        var text = new Dictionary<string, SpeciesText> { ["sl"] = Text(slName) };
        if (enName is not null)
        {
            text["en"] = Text(enName);
        }

        return new Species(
            SpeciesId.Parse(id),
            "plant",
            F(id),
            new Dictionary<string, Source>
            {
                ["src"] = new("src", "Title", "Publisher", new Uri("https://example.org"), new DateOnly(2026, 10, 2), "CC BY 4.0"),
                ["unused"] = new("unused", "Unused", "Nobody", new Uri("https://example.org/unused"), new DateOnly(2026, 10, 2), "CC BY 4.0"),
            },
            text);
    }
}
