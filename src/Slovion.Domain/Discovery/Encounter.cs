using Slovion.Domain.Content;

namespace Slovion.Domain.Discovery;

/// <summary>
/// One observation of a species at a spot, waiting for the player's single guess among the offered
/// candidates. Closed when answered or replaced by a newer encounter.
/// </summary>
public sealed class Encounter
{
    private Encounter(
        Guid id,
        Guid saveSlotId,
        SpeciesId speciesId,
        string mapId,
        string spotId,
        IReadOnlyList<SpeciesId> candidates,
        DateTimeOffset createdAt)
    {
        Id = id;
        SaveSlotId = saveSlotId;
        SpeciesId = speciesId;
        MapId = mapId;
        SpotId = spotId;
        Candidates = candidates;
        CreatedAt = createdAt;
    }

    public Guid Id { get; private set; }

    public Guid SaveSlotId { get; private set; }

    /// <summary>The correct answer. Never sent to the client before the encounter is answered.</summary>
    public SpeciesId SpeciesId { get; private set; }

    public string MapId { get; private set; }

    public string SpotId { get; private set; }

    /// <summary>Offered species in display order; contains <see cref="SpeciesId"/> exactly once.</summary>
    public IReadOnlyList<SpeciesId> Candidates { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? ClosedAt { get; private set; }

    public bool IsOpen => ClosedAt is null;

    public static Encounter Start(
        Guid id,
        Guid saveSlotId,
        MapSpot spot,
        IReadOnlyList<SpeciesId> candidates,
        DateTimeOffset createdAt)
    {
        ArgumentOutOfRangeException.ThrowIfEqual(id, Guid.Empty);
        ArgumentOutOfRangeException.ThrowIfEqual(saveSlotId, Guid.Empty);
        ArgumentNullException.ThrowIfNull(spot);
        ArgumentNullException.ThrowIfNull(candidates);

        if (candidates.Count < 2 || candidates.Distinct().Count() != candidates.Count)
        {
            throw new ArgumentException("An encounter needs at least two distinct candidates.", nameof(candidates));
        }

        if (!candidates.Contains(spot.SpeciesId))
        {
            throw new ArgumentException("The observed species must be one of the candidates.", nameof(candidates));
        }

        return new Encounter(id, saveSlotId, spot.SpeciesId, spot.MapId, spot.SpotId, candidates.ToList(), createdAt);
    }

    public bool IsCandidate(SpeciesId speciesId) => Candidates.Contains(speciesId);

    public bool IsCorrect(SpeciesId speciesId) => speciesId == SpeciesId;
}
