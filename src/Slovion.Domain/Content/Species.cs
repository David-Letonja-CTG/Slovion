using Slovion.Domain.World;

namespace Slovion.Domain.Content;

/// <summary>A real-world fact and the IDs of the sources it is based on (docs/decisions.md D6).</summary>
public sealed record Fact(string Value, IReadOnlyList<string> SourceIds);

/// <summary>Where real-world species facts come from.</summary>
public sealed record Source(string Id, string Title, string Publisher, Uri Url, DateOnly Accessed, string Licence);

/// <summary>Species facts in one language.</summary>
public sealed record SpeciesText(Fact Name, Fact Family, Fact Habitat, Fact Distribution, Fact Season, IReadOnlyList<Fact> Characteristics);

/// <summary>
/// Real-world species content. <see cref="Clues"/> is the only gameplay value: it chooses which
/// sourced characteristics serve as identification clues, and in which order (docs/decisions.md D1, D6).
/// </summary>
public sealed record Species(SpeciesId Id, SpeciesGroup Group, Fact ScientificName, IReadOnlyDictionary<string, Source> Sources, IReadOnlyDictionary<string, SpeciesText> Text, IReadOnlyList<int> Clues, Availability Availability, WildlifeTraits? Wildlife);

/// <summary>How a resident animal reacts to a lit torch in the dark. Fictional gameplay data (D6), never a fact.</summary>
public enum TorchReaction
{
    Curious,
    Shy,
    Calm,
}

/// <summary>Gameplay traits of an animal living in the world; plants have none.</summary>
public sealed record WildlifeTraits(TorchReaction Torch);

/// <summary>
/// When a species can be found: in which seasons and at which times of day, and in which weathers it is also found at
/// any time of day. Derived from sourced facts (flowering, flight or presence periods, activity) and backed by
/// <see cref="SourceIds"/> (docs/decisions.md D6, D8, D11).
/// </summary>
public sealed record Availability(IReadOnlySet<Season> Seasons, IReadOnlySet<TimeOfDay> Times, IReadOnlyList<string> SourceIds, IReadOnlySet<Weather>? AlsoInWeather = null)
{
    /// <summary>In one of its seasons, and at one of its times of day or in one of its "also in" weathers.</summary>
    public bool IsAvailableAt(WorldTime time, Weather weather)
    {
        ArgumentNullException.ThrowIfNull(time);
        return Seasons.Contains(time.Season) && (Times.Contains(time.TimeOfDay) || (AlsoInWeather?.Contains(weather) ?? false));
    }
}

/// <summary>An interactive place in a map where a species can be discovered.</summary>
public sealed record MapSpot(string MapId, string SpotId, SpeciesId SpeciesId);
