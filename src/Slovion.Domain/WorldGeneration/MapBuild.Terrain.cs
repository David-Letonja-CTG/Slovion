namespace Slovion.Domain.WorldGeneration;

/// <summary>Terrain stages: base, layers, openings, water, paths, decoration and pocket cleanup.</summary>
internal sealed partial class MapBuild
{
    /// <summary>Stage 1: the biome's floor everywhere, and a blocking border where the area meets the map's edge.</summary>
    private void Base(int area, Biome biome, WorldRandom stage)
    {
        foreach (var cell in Cells(template.Areas[area].Rect))
        {
            var x = cell % width;
            var y = cell / width;
            areaOf[cell] = area;
            ground[cell] = stage.Pick(biome.Floor);
            decor[cell] = NoTile;
            blocked[cell] = false;
            if (biome.Border.Count > 0 && (x == 0 || y == 0 || x == width - 1 || y == height - 1))
            {
                border[cell] = true;
                decor[cell] = stage.Pick(biome.Border);
                blocked[cell] = true;
            }
        }
    }

    /// <summary>
    /// Stage 2: each layer covers its share of the area in coherent blobs: value noise thresholded at the quantile that
    /// gives the coverage, then smoothed by a cellular automaton (a cell joins with 5+ of 9, leaves with 3 or fewer).
    /// </summary>
    private void Layers(int area, Biome biome, WorldRandom stage)
    {
        var rect = template.Areas[area].Rect;
        var cells = Cells(rect).Where(cell => !border[cell]).ToList();
        foreach (var terrain in biome.Layers)
        {
            var layerRandom = stage.Fork(terrain.Id);
            var noise = Noise(rect, terrain.Scale, layerRandom.Fork("noise"));
            var count = (int)Math.Round(terrain.Coverage * cells.Count);
            if (count <= 0)
            {
                continue;
            }

            var threshold = cells.Select(cell => noise[cell]).OrderByDescending(value => value).ElementAt(Math.Min(count, cells.Count) - 1);
            var inside = new bool[ground.Length];
            foreach (var cell in cells)
            {
                inside[cell] = noise[cell] >= threshold;
            }

            for (var pass = 0; pass < terrain.Smooth; pass++)
            {
                var next = (bool[])inside.Clone();
                foreach (var cell in cells)
                {
                    var around = Around(cell, rect).Count(other => !border[other] && inside[other]) + (inside[cell] ? 1 : 0);
                    next[cell] = around >= 5 || (around > 3 && inside[cell]);
                }

                inside = next;
            }

            var floor = layerRandom.Fork("floor");
            foreach (var cell in cells.Where(cell => inside[cell]))
            {
                layer[cell] = terrain.Id;
                if (terrain.Floor is { Count: > 0 } tiles)
                {
                    ground[cell] = floor.Pick(tiles);
                }
            }
        }
    }

    /// <summary>Stage 3: round open places with ragged edges, cut out of the layers.</summary>
    private void Openings(int area, Biome biome, WorldRandom stage)
    {
        if (biome.Openings is not { } openings)
        {
            return;
        }

        var rect = template.Areas[area].Rect;
        var count = stage.Range(openings.MinCount, openings.MaxCount);
        for (var i = 0; i < count; i++)
        {
            var radius = stage.Range(openings.MinRadius, openings.MaxRadius);
            var margin = radius + 1;
            if (rect.Width <= 2 * margin || rect.Height <= 2 * margin)
            {
                continue;
            }

            var cx = stage.Range(rect.X + margin, rect.Right - margin);
            var cy = stage.Range(rect.Y + margin, rect.Bottom - margin);
            openingCenters[area].Add(Index(cx, cy));
            foreach (var cell in Cells(rect))
            {
                var dx = (cell % width) - cx;
                var dy = (cell / width) - cy;
                if (!border[cell] && (dx * dx) + (dy * dy) <= (radius * radius) + stage.Next(radius + 1))
                {
                    opening[cell] = true;
                    layer[cell] = null;
                    ground[cell] = stage.Pick(openings.Floor);
                }
            }
        }
    }

    /// <summary>Stage 4: a meandering stream across the area, or a round pond; water blocks (wadeable tiles let boots through).</summary>
    private void Water(int area, Biome biome, WorldRandom stage)
    {
        if (biome.Water is not { } spec || !stage.Chance(spec.Chance))
        {
            return;
        }

        var rect = template.Areas[area].Rect;
        var cells = new List<int>();
        if (spec.Kind == WaterKind.Stream)
        {
            var vertical = rect.Height >= rect.Width;
            var length = vertical ? rect.Height : rect.Width;
            var low = (vertical ? rect.X : rect.Y) + 2;
            var high = (vertical ? rect.Right : rect.Bottom) - 1 - spec.Size;
            if (high < low)
            {
                return;
            }

            var quarter = (high - low) / 4;
            var position = stage.Range(low + quarter, high - quarter);
            for (var t = 0; t < length; t++)
            {
                if (t > 0)
                {
                    position = Math.Clamp(position + stage.Next(4) switch { 0 => -1, 3 => 1, _ => 0 }, low, high);
                }

                for (var k = 0; k < spec.Size; k++)
                {
                    cells.Add(vertical ? Index(position + k, rect.Y + t) : Index(rect.X + t, position + k));
                }
            }
        }
        else
        {
            var margin = spec.Size + 1;
            if (rect.Width <= 2 * margin || rect.Height <= 2 * margin)
            {
                return;
            }

            var cx = stage.Range(rect.X + margin, rect.Right - margin);
            var cy = stage.Range(rect.Y + margin, rect.Bottom - margin);
            foreach (var cell in Cells(rect))
            {
                var dx = (cell % width) - cx;
                var dy = (cell / width) - cy;
                if ((dx * dx) + (dy * dy) <= (spec.Size * spec.Size) + stage.Next(spec.Size + 1))
                {
                    cells.Add(cell);
                }
            }
        }

        foreach (var cell in cells.Where(cell => !border[cell]))
        {
            water[cell] = true;
            opening[cell] = false;
            layer[cell] = null;
            ground[cell] = stage.Pick(spec.Tiles);
            decor[cell] = NoTile;
            blocked[cell] = true;
        }

        if (spec.Bank is { Count: > 0 } bank)
        {
            foreach (var cell in Cells(rect).Where(cell => !water[cell] && !border[cell] && !opening[cell]
                && GridSearch.Neighbours(cell, width, height).Any(next => water[next])))
            {
                ground[cell] = stage.Pick(bank);
            }
        }
    }

    /// <summary>Distances used by selectors: to water, and to the boundary of every layer.</summary>
    private void Distances(int area, Biome biome)
    {
        var rect = template.Areas[area].Rect;
        var inArea = (int cell) => areaOf[cell] == area;
        var fromWater = GridSearch.Distances(width, height, Cells(rect).Where(cell => water[cell]), inArea);
        foreach (var cell in Cells(rect))
        {
            waterDistance[cell] = fromWater[cell];
        }

        foreach (var terrain in biome.Layers)
        {
            var id = terrain.Id;
            var boundary = Cells(rect).Where(cell => !border[cell]
                && GridSearch.Neighbours(cell, width, height).Any(next => inArea(next) && !border[next] && (layer[next] == id) != (layer[cell] == id)));
            edgeDistance[(area, id)] = GridSearch.Distances(width, height, boundary, cell => inArea(cell) && !border[cell]);
        }
    }

    /// <summary>
    /// Stage 5: paths join the connectors and lead to every opening, along the cheapest route (open floor is cheap,
    /// layers dearer, water dearest, crossed by a ford), with a little per-tile jitter so they wind.
    /// </summary>
    private void Paths(int area, WorldRandom stage)
    {
        var spec = template.Areas[area];
        if (spec.Connectors.Count == 0)
        {
            return;
        }

        var jitter = new double[ground.Length];
        foreach (var cell in Cells(spec.Rect))
        {
            jitter[cell] = stage.NextDouble() * 0.6;
        }

        var connectors = spec.Connectors.Select(point => Index(point.X, point.Y)).ToList();
        AddGlades(area, connectors, stage.Fork("glades"));
        path[connectors[0]] = true;
        var targets = connectors.Skip(1)
            .Concat(openingCenters[area].OrderBy(cell => Manhattan(cell, connectors[0])).ThenBy(cell => cell))
            .ToList();
        foreach (var target in targets.Where(target => !path[target]))
        {
            var route = GridSearch.CheapestPath(width, height, target, cell => path[cell] && areaOf[cell] == area, cell =>
                areaOf[cell] != area || border[cell] ? -1 : (water[cell] ? 8 : layer[cell] is null ? 1 : 3) + jitter[cell]);
            foreach (var cell in route ?? [])
            {
                OpenAsPath(cell);
            }
        }

        foreach (var cell in connectors)
        {
            OpenAsPath(cell);
        }
    }

    /// <summary>
    /// Land that water cuts off from the connectors and that has no opening gets a small glade at its centre, so a path
    /// (fording the water) leads there instead of the land being left unreachable.
    /// </summary>
    private void AddGlades(int area, List<int> connectors, WorldRandom stage)
    {
        const int MinimumLand = 8;
        var biome = biomes[template.Areas[area].BiomeId];
        var land = (int cell) => areaOf[cell] == area && !border[cell] && !water[cell];
        var seen = new bool[ground.Length];
        foreach (var start in Cells(template.Areas[area].Rect).Where(land))
        {
            if (seen[start])
            {
                continue;
            }

            var component = GridSearch.Reachable(width, height, start, land);
            var cells = Enumerable.Range(0, component.Length).Where(cell => component[cell]).ToList();
            cells.ForEach(cell => seen[cell] = true);
            if (cells.Count < MinimumLand || cells.Any(connectors.Contains) || cells.Any(openingCenters[area].Contains))
            {
                continue;
            }

            var cx = cells.Average(cell => cell % width);
            var cy = cells.Average(cell => cell / width);
            var centre = cells.OrderBy(cell => Math.Pow((cell % width) - cx, 2) + Math.Pow((cell / width) - cy, 2)).ThenBy(cell => cell).First();
            openingCenters[area].Add(centre);
            foreach (var cell in cells.Where(cell => Chebyshev(cell, centre) <= 1))
            {
                opening[cell] = true;
                layer[cell] = null;
                if (biome.Openings is { } openings)
                {
                    ground[cell] = stage.Pick(openings.Floor);
                }
            }
        }
    }

    /// <summary>Stage 6: decoration (trees, rocks, flowers) by the biome's rules, never on paths, water or the border.</summary>
    private void Decorate(int area, Biome biome, WorldRandom stage)
    {
        for (var i = 0; i < biome.Decor.Count; i++)
        {
            var rule = biome.Decor[i];
            var ruleRandom = stage.Fork($"decor:{i}");
            foreach (var cell in Cells(template.Areas[area].Rect))
            {
                var onWater = rule.Where.Kind == SelectorKind.Water;
                if (border[cell] || path[cell] || decor[cell] != NoTile || water[cell] != onWater || !Matches(rule.Where, cell, area))
                {
                    continue;
                }

                if (ruleRandom.Chance(rule.Density))
                {
                    decor[cell] = ruleRandom.Pick(rule.Tiles);
                    blocked[cell] |= rule.Blocking;
                }
            }
        }
    }

    /// <summary>
    /// Stage 7: no walkable tile may be cut off. A pocket gets a way opened to the reached tiles through decoration;
    /// one that cannot be opened (only water around it) is filled.
    /// </summary>
    private void CleanUpPockets()
    {
        for (var guard = 0; guard < ground.Length; guard++)
        {
            var reach = Reach();
            var pocket = Enumerable.Range(0, ground.Length).FirstOrDefault(cell => areaOf[cell] != Outside && !blocked[cell] && !reach[cell], -1);
            if (pocket < 0)
            {
                return;
            }

            var route = GridSearch.CheapestPath(width, height, pocket, cell => reach[cell], cell =>
                areaOf[cell] == Outside ? (TemplateWalkable(cell) ? 1 : -1) : border[cell] || water[cell] ? -1 : blocked[cell] ? 2 : 1);
            if (route is not null)
            {
                foreach (var cell in route.Where(cell => areaOf[cell] != Outside && blocked[cell]))
                {
                    decor[cell] = NoTile;
                    blocked[cell] = false;
                }

                continue;
            }

            var cut = GridSearch.Reachable(width, height, pocket, cell => areaOf[cell] != Outside && !blocked[cell]);
            var filler = biomes[template.Areas[areaOf[pocket]].BiomeId];
            var tiles = filler.Decor.FirstOrDefault(rule => rule.Blocking)?.Tiles ?? filler.Border;
            for (var cell = 0; cell < cut.Length; cell++)
            {
                if (cut[cell])
                {
                    decor[cell] = tiles.Count > 0 ? tiles[cell % tiles.Count] : NoTile;
                    blocked[cell] = true;
                }
            }
        }
    }

    /// <summary>Value noise: random values on a lattice <paramref name="scale"/> tiles apart, smoothly interpolated, plus a finer octave.</summary>
    private double[] Noise(GridRect rect, int scale, WorldRandom stage)
    {
        var result = new double[ground.Length];
        var coarse = Lattice(rect, Math.Max(1, scale), stage.Fork("coarse"));
        var fine = Lattice(rect, Math.Max(1, scale / 2), stage.Fork("fine"));
        foreach (var cell in Cells(rect))
        {
            result[cell] = coarse(cell) + (0.5 * fine(cell));
        }

        return result;
    }

    private Func<int, double> Lattice(GridRect rect, int spacing, WorldRandom stage)
    {
        var columns = (rect.Width / spacing) + 2;
        var rows = (rect.Height / spacing) + 2;
        var values = new double[columns * rows];
        for (var i = 0; i < values.Length; i++)
        {
            values[i] = stage.NextDouble();
        }

        return cell =>
        {
            var fx = ((cell % width) - rect.X) / (double)spacing;
            var fy = ((cell / width) - rect.Y) / (double)spacing;
            var ix = (int)fx;
            var iy = (int)fy;
            var tx = Smooth(fx - ix);
            var ty = Smooth(fy - iy);
            var top = Lerp(values[(iy * columns) + ix], values[(iy * columns) + ix + 1], tx);
            var bottom = Lerp(values[((iy + 1) * columns) + ix], values[((iy + 1) * columns) + ix + 1], tx);
            return Lerp(top, bottom, ty);
        };
    }

    private static double Smooth(double t) => t * t * (3 - (2 * t));

    private static double Lerp(double a, double b, double t) => a + ((b - a) * t);

    /// <summary>The eight cells around <paramref name="cell"/> inside <paramref name="rect"/>.</summary>
    private IEnumerable<int> Around(int cell, GridRect rect)
    {
        var x = cell % width;
        var y = cell / width;
        for (var dy = -1; dy <= 1; dy++)
        {
            for (var dx = -1; dx <= 1; dx++)
            {
                if ((dx != 0 || dy != 0) && rect.Contains(x + dx, y + dy))
                {
                    yield return Index(x + dx, y + dy);
                }
            }
        }
    }

    private int Manhattan(int a, int b) => Math.Abs((a % width) - (b % width)) + Math.Abs((a / width) - (b / width));

    private bool Matches(CellSelector selector, int cell, int area) => selector.Kind switch
    {
        SelectorKind.Any => true,
        SelectorKind.Floor => layer[cell] is null && !opening[cell] && !water[cell],
        SelectorKind.Layer => layer[cell] == selector.Layer,
        SelectorKind.Opening => opening[cell],
        SelectorKind.Water => water[cell],
        SelectorKind.NearWater => !water[cell] && waterDistance[cell] <= selector.Distance,
        SelectorKind.Edge => edgeDistance.TryGetValue((area, selector.Layer!), out var distance) && distance[cell] < selector.Distance,
        _ => false,
    };
}
