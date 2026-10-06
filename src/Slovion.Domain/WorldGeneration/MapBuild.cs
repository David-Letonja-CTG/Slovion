namespace Slovion.Domain.WorldGeneration;

/// <summary>
/// One generation attempt over a whole map (design §6). Cells outside the generated areas keep the template; inside,
/// the stages run in order: base, terrain layers, openings, water, paths, decoration; then, over the whole map, pocket
/// cleanup, zones, species spots and path tiles.
/// </summary>
internal sealed partial class MapBuild
{
    private const int NoTile = -1;
    private const int Outside = -1;

    private readonly MapTemplate template;
    private readonly IReadOnlyDictionary<string, Biome> biomes;
    private readonly WorldRandom random;
    private readonly int width;
    private readonly int height;
    private readonly int spawn;
    private readonly int[] ground;
    private readonly int[] decor;
    private readonly bool[] blocked;
    private readonly int[] areaOf;
    private readonly bool[] objectCell;
    private readonly bool[] border;
    private readonly bool[] opening;
    private readonly bool[] water;
    private readonly bool[] path;
    private readonly string?[] layer;
    private readonly string?[] zoneKind;
    private readonly string?[] habitat;
    private readonly int[] waterDistance;
    private readonly List<int>[] connectors;
    private readonly List<(int Area, int Cell)> gates = [];
    private readonly Dictionary<(int Area, string Layer), int[]> edgeDistance = [];
    private readonly List<List<int>> openingCenters = [];
    private readonly List<(string SpeciesId, int Cell)> spots = [];
    private readonly List<string> missing = [];

    public MapBuild(MapTemplate template, IReadOnlyDictionary<string, Biome> biomes, WorldRandom random)
    {
        this.template = template;
        this.biomes = biomes;
        this.random = random;
        width = template.Width;
        height = template.Height;
        var cells = width * height;
        spawn = Index(template.Spawn.X, template.Spawn.Y);
        ground = [.. template.Ground];
        decor = [.. template.Decor];
        blocked = [.. template.Blocked];
        areaOf = Enumerable.Repeat(Outside, cells).ToArray();
        objectCell = new bool[cells];
        border = new bool[cells];
        opening = new bool[cells];
        water = new bool[cells];
        path = new bool[cells];
        layer = new string?[cells];
        zoneKind = new string?[cells];
        habitat = new string?[cells];
        waterDistance = Enumerable.Repeat(int.MaxValue, cells).ToArray();
        connectors = [.. template.Areas.Select(area => area.Connectors.Select(point => Index(point.X, point.Y)).ToList())];
        foreach (var point in template.BlockingObjects)
        {
            objectCell[Index(point.X, point.Y)] = true;
        }
    }

    public void Run()
    {
        for (var area = 0; area < template.Areas.Count; area++)
        {
            var spec = template.Areas[area];
            var biome = biomes[spec.BiomeId];
            var areaRandom = random.Fork($"area:{area}");
            openingCenters.Add([]);
            Base(area, biome, areaRandom.Fork("base"));
            Layers(area, biome, areaRandom.Fork("layers"));
            Openings(area, biome, areaRandom.Fork("openings"));
            Water(area, biome, areaRandom.Fork("water"));
            Distances(area, biome);
            Paths(area, areaRandom.Fork("paths"));
            Decorate(area, biome, areaRandom.Fork("decor"));
        }

        OpenGateApproaches();
        CleanUpPockets();
        for (var area = 0; area < template.Areas.Count; area++)
        {
            Zones(area, biomes[template.Areas[area].BiomeId]);
        }

        for (var area = 0; area < template.Areas.Count; area++)
        {
            PlaceSpecies(area, random.Fork($"area:{area}").Fork("spots"), spacingFrom: 3);
        }

        TilePaths();
    }

    /// <summary>Everything that makes this map unplayable; empty when it is valid (design §6, stage 9).</summary>
    public List<string> Problems()
    {
        var problems = new List<string>();
        var reach = Reach();
        var wading = WadeReach();
        foreach (var connector in connectors.SelectMany(cells => cells).Where(cell => !reach[cell]))
        {
            problems.Add($"connector ({connector % width}, {connector / width}) unreachable");
        }

        // A barrier keeps its area closed until the gate opens: without the flag nothing in it can be reached.
        var gateCells = gates.Select(gate => gate.Cell).ToHashSet();
        var closed = GridSearch.Reachable(width, height, spawn, cell => Walkable(cell) && !gateCells.Contains(cell));
        foreach (var (area, _) in gates)
        {
            if (Cells(template.Areas[area].Rect).Any(cell => closed[cell]))
            {
                problems.Add($"area {template.Areas[area].AreaId} reachable without its gate");
            }
        }

        foreach (var (speciesId, cell) in spots)
        {
            if (!CanReach(cell, reach) && !wading[cell])
            {
                problems.Add($"spot of {speciesId} unreachable");
            }
        }

        problems.AddRange(missing.Select(speciesId => $"no place for {speciesId}"));
        for (var cell = 0; cell < areaOf.Length; cell++)
        {
            if (areaOf[cell] != Outside && !blocked[cell] && !reach[cell])
            {
                problems.Add($"walkable tile ({cell % width}, {cell / width}) unreachable");
                break;
            }
        }

        return problems;
    }

    /// <summary>The deterministic fallback: carve a way to everything unreachable and place missing species anywhere allowed.</summary>
    public void Repair()
    {
        var reach = Reach();
        var wading = WadeReach();
        var targets = connectors.SelectMany(cells => cells)
            .Concat(spots.Select(spot => spot.Cell))
            .Where(cell => !CanReach(cell, reach) && !wading[cell])
            .ToList();
        foreach (var target in targets)
        {
            Carve(target, reach);
            reach = Reach();
        }

        if (missing.Count > 0)
        {
            var retry = missing.ToList();
            missing.Clear();
            for (var area = 0; area < template.Areas.Count; area++)
            {
                PlaceSpecies(area, random.Fork($"area:{area}").Fork("repair"), spacingFrom: 0, only: retry);
            }
        }

        CleanUpPockets();
        TilePaths();
    }

    public GeneratedMap ToMap(int attempts, bool repaired)
    {
        var habitats = new List<ZoneRect>();
        var areas = new List<ZoneRect>();
        foreach (var area in template.Areas)
        {
            habitats.AddRange(Rectangles(area.Rect));
            areas.Add(new ZoneRect(area.AreaId, area.Rect, area.Underground));
        }

        var placed = spots.Select(spot => new GeneratedSpot(spot.SpeciesId, new GridPoint(spot.Cell % width, spot.Cell / width))).ToList();
        var placedGates = gates.Select(gate => new GeneratedGate(
            new GridPoint(gate.Cell % width, gate.Cell / width),
            template.Areas[gate.Area].Barrier!.Flag,
            biomes[template.Areas[gate.Area].BiomeId].Gate!.Value)).ToList();
        return new GeneratedMap(width, height, [.. ground], [.. decor], [.. blocked], placed, habitats, areas, placedGates, [.. zoneKind], attempts, repaired);
    }

    private int Index(int x, int y) => (y * width) + x;

    private IEnumerable<int> Cells(GridRect rect)
    {
        for (var y = rect.Y; y <= rect.Bottom; y++)
        {
            for (var x = rect.X; x <= rect.Right; x++)
            {
                yield return Index(x, y);
            }
        }
    }

    private bool TemplateWalkable(int cell) => !template.Blocked[cell] && !objectCell[cell];

    private bool Walkable(int cell) => areaOf[cell] == Outside ? TemplateWalkable(cell) : !blocked[cell];

    private bool[] Reach() => GridSearch.Reachable(width, height, spawn, Walkable);

    /// <summary>Water the boots let the player through: a wadeable ground tile with no blocking object on it.</summary>
    private bool Wadeable(int cell) => template.WadeableTiles?.Contains(ground[cell]) == true && !objectCell[cell];

    /// <summary>What the player reaches with the boots, wading through wadeable water.</summary>
    private bool[] WadeReach() => GridSearch.Reachable(width, height, spawn, cell => Walkable(cell) || Wadeable(cell));

    /// <summary>A walkable cell the player reaches, or a blocked one (water, a shrub, a perch) beside such a cell.</summary>
    private bool CanReach(int cell, bool[] reach) =>
        Walkable(cell) ? reach[cell] : GridSearch.Neighbours(cell, width, height).Any(next => reach[next]);

    /// <summary>Opens the cheapest way from <paramref name="target"/> to the reached tiles through generated, non-border tiles.</summary>
    private void Carve(int target, bool[] reach)
    {
        var route = GridSearch.CheapestPath(width, height, target, cell => reach[cell], cell =>
            areaOf[cell] == Outside ? (TemplateWalkable(cell) ? 1 : -1) : border[cell] ? -1 : 1);
        if (route is null)
        {
            return;
        }

        foreach (var cell in route.Skip(1))
        {
            if (areaOf[cell] != Outside && blocked[cell])
            {
                OpenAsPath(cell);
            }
        }
    }

    /// <summary>Makes a generated cell a walkable path (a ford where it was water).</summary>
    private void OpenAsPath(int cell)
    {
        path[cell] = true;
        water[cell] = false;
        decor[cell] = NoTile;
        blocked[cell] = false;
    }
}
