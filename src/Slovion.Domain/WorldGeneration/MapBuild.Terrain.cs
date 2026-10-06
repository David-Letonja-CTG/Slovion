namespace Slovion.Domain.WorldGeneration;

/// <summary>Terrain stages: base, layers, openings, water, paths, decoration and pocket cleanup.</summary>
internal sealed partial class MapBuild
{
    /// <summary>The span of the value noise (a coarse octave plus half a fine one), which a layer's bias is measured against.</summary>
    private const double NoiseRange = 1.5;

    /// <summary>
    /// Stage 1: the biome's floor everywhere, and a blocking border where the area meets the map's edge and along a
    /// barrier, whose gate lies at a random place with walkable ground on both sides.
    /// </summary>
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

        if (template.Areas[area].Barrier is { } barrier)
        {
            BuildBarrier(area, barrier.Edge, biome, stage.Fork("barrier"));
        }
    }

    /// <summary>The border along <paramref name="edge"/>, except at one gate (not at a corner) whose outer side is walkable ground.</summary>
    private void BuildBarrier(int area, Edge edge, Biome biome, WorldRandom stage)
    {
        var rect = template.Areas[area].Rect;
        var line = Cells(rect).Where(cell => edge switch
        {
            Edge.North => cell / width == rect.Y,
            Edge.South => cell / width == rect.Bottom,
            Edge.West => cell % width == rect.X,
            _ => cell % width == rect.Right,
        }).ToList();
        var candidates = line.Skip(1).SkipLast(1).Where(cell => Outward(cell, edge) is { } outside && TemplateWalkable(outside)).ToList();
        var gate = candidates.Count > 0 ? stage.Pick(candidates) : -1;
        foreach (var cell in line.Where(cell => cell != gate))
        {
            border[cell] = true;
            decor[cell] = stage.Pick(biome.Border);
            blocked[cell] = true;
        }

        if (gate >= 0)
        {
            gates.Add((area, gate));
            connectors[area].Insert(0, gate);
        }
    }

    /// <summary>The tile in front of each gate, outside its area, is cleared so the gate can be reached.</summary>
    private void OpenGateApproaches()
    {
        foreach (var (area, gate) in gates)
        {
            var outside = Outward(gate, template.Areas[area].Barrier!.Edge)!.Value;
            if (areaOf[outside] != Outside && blocked[outside] && !border[outside] && !water[outside])
            {
                Unblock(outside);
            }
        }
    }

    /// <summary>The neighbour of <paramref name="cell"/> beyond <paramref name="edge"/>, or <c>null</c> off the map.</summary>
    private int? Outward(int cell, Edge edge)
    {
        var (x, y) = edge switch
        {
            Edge.North => (cell % width, (cell / width) - 1),
            Edge.South => (cell % width, (cell / width) + 1),
            Edge.West => ((cell % width) - 1, cell / width),
            _ => ((cell % width) + 1, cell / width),
        };
        return x < 0 || y < 0 || x >= width || y >= height ? null : Index(x, y);
    }

    /// <summary>
    /// Stage 2: each layer covers its share of the area in coherent blobs: value noise thresholded at the quantile that
    /// gives the coverage, then smoothed by a cellular automaton (a cell joins with 5+ of 9, leaves with 3 or fewer). A
    /// biased layer's noise rises towards its edge, so it gathers there.
    /// </summary>
    private void Layers(int area, Biome biome, WorldRandom stage)
    {
        var rect = template.Areas[area].Rect;
        var cells = Cells(rect).Where(cell => !border[cell]).ToList();
        foreach (var terrain in biome.Layers)
        {
            var layerRandom = stage.Fork(terrain.Id);
            var noise = Noise(rect, terrain.Scale, layerRandom.Fork("noise"));
            if (terrain.Bias is { } edge)
            {
                foreach (var cell in cells)
                {
                    noise[cell] += terrain.BiasStrength * NoiseRange * (1 - Depth(cell, rect, edge));
                }
            }

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
                blocked[cell] = terrain.Blocking;
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
                    blocked[cell] = false;
                    ground[cell] = stage.Pick(openings.Floor);
                }
            }
        }
    }

    /// <summary>
    /// Stage 4: a meandering stream across the area, a round pond, or a shore along one edge whose shallows lie towards
    /// the land; water blocks (wadeable tiles let boots through). A shore also covers the border, so the water reaches
    /// the map's edge.
    /// </summary>
    private void Water(int area, Biome biome, WorldRandom stage)
    {
        if (biome.Water is not { } spec || !stage.Chance(spec.Chance))
        {
            return;
        }

        var rect = template.Areas[area].Rect;
        var cells = new List<int>();
        var shallow = new HashSet<int>();
        if (spec.Kind == WaterKind.Shore)
        {
            Shore(rect, spec, stage, cells, shallow);
        }
        else if (spec.Kind == WaterKind.Stream)
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

        foreach (var cell in cells.Where(cell => spec.Kind == WaterKind.Shore || !border[cell]))
        {
            water[cell] = true;
            opening[cell] = false;
            layer[cell] = null;
            ground[cell] = shallow.Contains(cell) && !border[cell] && spec.Shallow is { Count: > 0 } shallows ? stage.Pick(shallows) : stage.Pick(spec.Tiles);
            decor[cell] = NoTile;
            blocked[cell] = true;
        }

        // An opening the water drowned is no longer somewhere for a path to lead.
        openingCenters[area].RemoveAll(cell => water[cell]);
        if (spec.Bank is { Count: > 0 } bank)
        {
            foreach (var cell in Cells(rect).Where(cell => !water[cell] && !border[cell] && !opening[cell] && !blocked[cell]
                && GridSearch.Neighbours(cell, width, height).Any(next => water[next])))
            {
                ground[cell] = stage.Pick(bank);
            }
        }
    }

    /// <summary>A shore along the water's edge: per row (or column) its depth wanders by a tile around its size plus the shallows.</summary>
    private void Shore(GridRect rect, Water spec, WorldRandom stage, List<int> cells, HashSet<int> shallow)
    {
        var alongX = spec.Edge is Edge.North or Edge.South;
        var length = alongX ? rect.Width : rect.Height;
        var span = alongX ? rect.Height : rect.Width;
        var full = spec.Size + spec.ShallowWidth;
        var depth = Math.Clamp(full + stage.Next(3) - 1, 1, span - 1);
        for (var t = 0; t < length; t++)
        {
            if (t > 0)
            {
                depth = Math.Clamp(depth + stage.Next(4) switch { 0 => -1, 3 => 1, _ => 0 }, Math.Max(1, full - 1), Math.Min(span - 1, full + 1));
            }

            for (var k = 0; k < depth; k++)
            {
                var cell = spec.Edge switch
                {
                    Edge.North => Index(rect.X + t, rect.Y + k),
                    Edge.South => Index(rect.X + t, rect.Bottom - k),
                    Edge.West => Index(rect.X + k, rect.Y + t),
                    _ => Index(rect.Right - k, rect.Y + t),
                };
                cells.Add(cell);
                if (k >= depth - spec.ShallowWidth)
                {
                    shallow.Add(cell);
                }
            }
        }
    }

    /// <summary>
    /// Stage 4a: structures (design §5a), each at a random place where it fits whole on dry ground with a free tile all
    /// around it (its yard, never decorated) and an open tile before its door, which paths then lead to.
    /// </summary>
    private void Structures(int area, Biome biome, WorldRandom stage)
    {
        const int Tries = 60;
        var rect = template.Areas[area].Rect;
        foreach (var rule in biome.Structures ?? [])
        {
            var shape = rule.Prefab;
            var count = stage.Range(rule.MinCount, rule.MaxCount);
            for (var placed = 0; placed < count; placed++)
            {
                for (var attempt = 0; attempt < Tries; attempt++)
                {
                    var x = stage.Range(rect.X, rect.Right - shape.Width + 1);
                    var y = rule.AlongNorth ? rect.Y : stage.Range(rect.Y, rect.Bottom - shape.Height + 1);
                    if (StructureFits(area, shape, x, y))
                    {
                        PlaceStructure(area, shape, x, y);
                        break;
                    }
                }
            }
        }
    }

    private bool StructureFits(int area, Prefab shape, int x, int y)
    {
        var rect = template.Areas[area].Rect;
        bool Free(int cx, int cy) => rect.Contains(cx, cy) && !border[Index(cx, cy)] && !water[Index(cx, cy)] && !structure[Index(cx, cy)];
        for (var dy = -1; dy <= shape.Height; dy++)
        {
            for (var dx = -1; dx <= shape.Width; dx++)
            {
                var (cx, cy) = (x + dx, y + dy);
                var inside = dx >= 0 && dy >= 0 && dx < shape.Width && dy < shape.Height;
                if (inside ? !Free(cx, cy) : cx >= 0 && cy >= 0 && cx < width && cy < height && structure[Index(cx, cy)])
                {
                    return false;
                }
            }
        }

        return shape.Door is not { } door || Free(x + door.X, y + door.Y + 1);
    }

    private void PlaceStructure(int area, Prefab shape, int x, int y)
    {
        for (var dy = -1; dy <= shape.Height; dy++)
        {
            for (var dx = -1; dx <= shape.Width; dx++)
            {
                var (cx, cy) = (x + dx, y + dy);
                if (cx < 0 || cy < 0 || cx >= width || cy >= height || areaOf[Index(cx, cy)] != area)
                {
                    continue;
                }

                var cell = Index(cx, cy);
                if (dx < 0 || dy < 0 || dx >= shape.Width || dy >= shape.Height)
                {
                    // The yard: open ground around the structure.
                    yard[cell] = !border[cell] && !water[cell];
                    if (yard[cell] && LayerBlocks(cell))
                    {
                        Unblock(cell);
                    }

                    continue;
                }

                var isPerch = shape.Perches.Contains(new GridPoint(dx, dy));
                structure[cell] = true;
                perch[cell] = isPerch;
                structureZone[cell] = isPerch ? shape.PerchZone : shape.Zone;
                ground[cell] = shape.Ground[(dy * shape.Width) + dx];
                decor[cell] = NoTile;
                blocked[cell] = shape.Blocking;
                layer[cell] = null;
                opening[cell] = false;
            }
        }

        if (shape.Door is { } door)
        {
            openingCenters[area].Add(Index(x + door.X, y + door.Y + 1));
        }
    }

    /// <summary>Stage 5a: lamp posts beside the paths, spaced apart; never on a door's step or a connector.</summary>
    private void PlaceLamps(int area, Biome biome, WorldRandom stage)
    {
        if (biome.Lamps is not { } rule)
        {
            return;
        }

        var keepFree = openingCenters[area].Concat(connectors[area]).ToHashSet();
        var candidates = Cells(template.Areas[area].Rect)
            .Where(cell => !path[cell] && !border[cell] && !water[cell] && !structure[cell] && !blocked[cell] && !keepFree.Contains(cell)
                && GridSearch.Neighbours(cell, width, height).Any(next => path[next]))
            .OrderBy(_ => stage.Next(1 << 20))
            .ToList();
        foreach (var cell in candidates.Where(cell => lamps.All(lamp => Chebyshev(cell, lamp.Cell) >= rule.Spacing)))
        {
            lamps.Add((cell, rule.Tile));
            decor[cell] = NoTile;
            blocked[cell] = true;
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
        var connectors = this.connectors[area];
        if (connectors.Count == 0)
        {
            return;
        }

        var jitter = new double[ground.Length];
        foreach (var cell in Cells(spec.Rect))
        {
            jitter[cell] = stage.NextDouble() * 0.6;
        }

        AddGlades(area, connectors, stage.Fork("glades"));
        path[connectors[0]] = true;
        var targets = connectors.Skip(1)
            .Concat(openingCenters[area].OrderBy(cell => Manhattan(cell, connectors[0])).ThenBy(cell => cell))
            .ToList();
        foreach (var target in targets.Where(target => !path[target]))
        {
            var route = GridSearch.CheapestPath(width, height, target, cell => path[cell] && areaOf[cell] == area, cell =>
                areaOf[cell] != area || border[cell] || structure[cell] ? -1 : (water[cell] ? 8 : layer[cell] is null ? 1 : 3) + jitter[cell]);
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
                blocked[cell] = false;
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
                if (border[cell] || path[cell] || structure[cell] || yard[cell] || Fixed(cell) || decor[cell] != NoTile || water[cell] != onWater || !Matches(rule.Where, cell, area))
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
                areaOf[cell] == Outside ? (TemplateWalkable(cell) ? 1 : -1) : border[cell] || water[cell] || Fixed(cell) ? -1 : blocked[cell] ? 2 : 1);
            if (route is not null)
            {
                foreach (var cell in route.Where(cell => areaOf[cell] != Outside && blocked[cell]))
                {
                    Unblock(cell);
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

    /// <summary>Opens a generated cell: its decoration goes, and a blocking layer there gives way to the biome's floor.</summary>
    private void Unblock(int cell)
    {
        decor[cell] = NoTile;
        blocked[cell] = false;
        if (LayerBlocks(cell))
        {
            var floor = biomes[template.Areas[areaOf[cell]].BiomeId].Floor;
            layer[cell] = null;
            ground[cell] = floor[cell % floor.Count];
        }
    }

    private bool LayerBlocks(int cell) =>
        layer[cell] is { } id && biomes[template.Areas[areaOf[cell]].BiomeId].Layers.Any(terrain => terrain.Id == id && terrain.Blocking);

    /// <summary>How far <paramref name="cell"/> lies from <paramref name="edge"/> of <paramref name="rect"/>: 0 on it, 1 on the opposite side.</summary>
    private double Depth(int cell, GridRect rect, Edge edge)
    {
        var x = (cell % width) - rect.X;
        var y = (cell / width) - rect.Y;
        return edge switch
        {
            Edge.North => y / (double)Math.Max(1, rect.Height - 1),
            Edge.South => 1 - (y / (double)Math.Max(1, rect.Height - 1)),
            Edge.West => x / (double)Math.Max(1, rect.Width - 1),
            _ => 1 - (x / (double)Math.Max(1, rect.Width - 1)),
        };
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
        SelectorKind.Structure => structure[cell],
        SelectorKind.NearWater => !water[cell] && waterDistance[cell] <= selector.Distance,
        SelectorKind.Edge => edgeDistance.TryGetValue((area, selector.Layer!), out var distance) && distance[cell] < selector.Distance,
        _ => false,
    };
}
