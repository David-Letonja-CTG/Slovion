namespace Slovion.Domain.WorldGeneration;

/// <summary>Placement stages: zones, species spots, path tiles and habitat rectangles.</summary>
internal sealed partial class MapBuild
{
    /// <summary>How close to the spawn a species marked near the spawn must be, in steps.</summary>
    private const int NearSpawnSteps = 6;

    /// <summary>How close to water a species that lives near water must be, in tiles.</summary>
    private const int NearWaterTiles = 3;

    /// <summary>Stage 8: every tile except paths and the border gets the first zone kind whose rule matches.</summary>
    private void Zones(int area, Biome biome)
    {
        foreach (var cell in Cells(template.Areas[area].Rect))
        {
            zoneKind[cell] = null;
            habitat[cell] = null;
            if (border[cell] || path[cell])
            {
                continue;
            }

            if (structure[cell])
            {
                // A structure's tiles take its own zone kind (a salt-pan basin, a chimney), with the biome's habitat for it.
                zoneKind[cell] = structureZone[cell];
                habitat[cell] = biome.Zones.FirstOrDefault(rule => rule.Kind == structureZone[cell])?.HabitatId;
                continue;
            }

            var rule = biome.Zones.FirstOrDefault(rule => rule.Where.Kind != SelectorKind.Structure && Matches(rule.Where, cell, area));
            zoneKind[cell] = rule?.Kind;
            habitat[cell] = rule?.HabitatId;
        }
    }

    /// <summary>
    /// Stage 9: one spot per listed species, on a reachable tile of a zone kind it accepts, weighted towards the kinds it
    /// prefers and spaced from other spots, the connectors and the spawn (the spacing relaxes when nothing fits).
    /// </summary>
    private void PlaceSpecies(int area, WorldRandom stage, int spacingFrom, IReadOnlyList<string>? only = null)
    {
        var spec = template.Areas[area];
        var reach = Reach();
        var wading = WadeReach();
        var fromSpawn = GridSearch.Distances(width, height, [spawn], Walkable);
        var keepAway = connectors[area].Append(spawn).ToList();
        foreach (var request in spec.Species)
        {
            if ((only is not null && !only.Contains(request.SpeciesId)) || spots.Any(spot => spot.SpeciesId == request.SpeciesId))
            {
                continue;
            }

            var placement = request.Placement;
            var weighted = new List<(int Cell, int Weight)>();
            for (var spacing = spacingFrom; spacing >= 0 && weighted.Count == 0; spacing--)
            {
                foreach (var cell in Cells(spec.Rect))
                {
                    var preference = zoneKind[cell] is { } kind ? IndexOf(placement.Zones, kind) : -1;
                    if (preference >= 0 && Fits(cell, placement, reach, wading) && NearSpawn(cell, placement, fromSpawn)
                        && spots.Select(spot => spot.Cell).Concat(keepAway).All(other => Chebyshev(cell, other) >= spacing))
                    {
                        weighted.Add((cell, placement.Zones.Count - preference));
                    }
                }
            }

            // Nothing near the spawn fits: the compatible tile nearest to it.
            if (weighted.Count == 0 && placement.NearSpawn
                && Cells(spec.Rect).Where(cell => zoneKind[cell] is { } kind && placement.Zones.Contains(kind) && Fits(cell, placement, reach, wading) && spots.All(spot => spot.Cell != cell))
                    .OrderBy(cell => StepsFromSpawn(cell, fromSpawn)).ThenBy(cell => cell).FirstOrDefault(-1) is var nearest and >= 0)
            {
                weighted.Add((nearest, 1));
            }

            if (weighted.Count == 0)
            {
                missing.Add(request.SpeciesId);
                continue;
            }

            var roll = stage.Next(weighted.Sum(candidate => candidate.Weight));
            var chosen = weighted.First(candidate => (roll -= candidate.Weight) < 0).Cell;
            spots.Add((request.SpeciesId, chosen));
            if (placement.Tile is { } tile)
            {
                decor[chosen] = tile;
                blocked[chosen] |= placement.Blocking;
                reach = Reach();
                wading = WadeReach();
            }
        }
    }

    private bool Fits(int cell, SpeciesPlacement placement, bool[] reach, bool[] wading)
    {
        if (border[cell] || path[cell])
        {
            return false;
        }

        var neighbourReached = GridSearch.Neighbours(cell, width, height).Any(next => reach[next]);
        var fits = placement.Water switch
        {
            WaterNeed.In => water[cell] && neighbourReached,
            WaterNeed.Wade => water[cell] && Wadeable(cell) && wading[cell] && !neighbourReached,
            _ when water[cell] => false,
            _ when placement.Perched => blocked[cell] && (decor[cell] != NoTile || perch[cell]) && neighbourReached,
            WaterNeed.Near => !blocked[cell] && reach[cell] && waterDistance[cell] <= NearWaterTiles,
            _ => !blocked[cell] && reach[cell] && (!placement.Blocking || neighbourReached),
        };
        return fits;
    }

    private bool NearSpawn(int cell, SpeciesPlacement placement, int[] fromSpawn) =>
        !placement.NearSpawn || StepsFromSpawn(cell, fromSpawn) <= NearSpawnSteps;

    /// <summary>Steps from the spawn to the tile, or for a blocked tile to the nearest tile beside it.</summary>
    private int StepsFromSpawn(int cell, int[] fromSpawn) =>
        blocked[cell] ? GridSearch.Neighbours(cell, width, height).Min(next => fromSpawn[next]) : fromSpawn[cell];

    /// <summary>
    /// Path tiles by their neighbours (design §5): a set of 16 per floor, +1/+2/+4/+8 when the north/east/south/west side
    /// is closed; a biome without path tiles keeps its floor there.
    /// </summary>
    private void TilePaths()
    {
        for (var cell = 0; cell < ground.Length; cell++)
        {
            if (areaOf[cell] == Outside || !path[cell])
            {
                continue;
            }

            var biome = biomes[template.Areas[areaOf[cell]].BiomeId];
            var set = opening[cell] && biome.Openings is { } openings ? openings.PathSet : biome.PathSet;
            if (set is null)
            {
                ground[cell] = biome.Floor[cell % biome.Floor.Count];
                continue;
            }

            var x = cell % width;
            var y = cell / width;
            ground[cell] = set.Value
                + (IsPath(x, y - 1) ? 0 : 1)
                + (IsPath(x + 1, y) ? 0 : 2)
                + (IsPath(x, y + 1) ? 0 : 4)
                + (IsPath(x - 1, y) ? 0 : 8);
        }
    }

    private bool IsPath(int x, int y)
    {
        if (x < 0 || y < 0 || x >= width || y >= height)
        {
            return false;
        }

        var cell = Index(x, y);
        return areaOf[cell] == Outside ? template.PathTiles.Contains(template.Ground[cell]) : path[cell];
    }

    /// <summary>The area's habitat tiles as non-overlapping rectangles, merging equal runs of consecutive rows.</summary>
    private List<ZoneRect> Rectangles(GridRect rect)
    {
        var done = new List<ZoneRect>();
        var active = new List<(string Id, int X0, int X1, int Y0)>();
        for (var y = rect.Y; y <= rect.Bottom + 1; y++)
        {
            var runs = new List<(string Id, int X0, int X1)>();
            for (var x = rect.X; y <= rect.Bottom && x <= rect.Right;)
            {
                if (habitat[Index(x, y)] is not { } id)
                {
                    x++;
                    continue;
                }

                var start = x;
                while (x <= rect.Right && habitat[Index(x, y)] == id)
                {
                    x++;
                }

                runs.Add((id, start, x - 1));
            }

            var next = new List<(string Id, int X0, int X1, int Y0)>();
            foreach (var run in runs)
            {
                var continued = active.FindIndex(open => open.Id == run.Id && open.X0 == run.X0 && open.X1 == run.X1);
                if (continued >= 0)
                {
                    next.Add(active[continued]);
                    active.RemoveAt(continued);
                }
                else
                {
                    next.Add((run.Id, run.X0, run.X1, y));
                }
            }

            done.AddRange(active.Select(open => new ZoneRect(open.Id, new GridRect(open.X0, open.Y0, open.X1 - open.X0 + 1, y - open.Y0))));
            active = next;
        }

        return done;
    }

    private int Chebyshev(int a, int b) => Math.Max(Math.Abs((a % width) - (b % width)), Math.Abs((a / width) - (b / width)));

    private static int IndexOf(IReadOnlyList<string> items, string item)
    {
        for (var i = 0; i < items.Count; i++)
        {
            if (items[i] == item)
            {
                return i;
            }
        }

        return -1;
    }
}
