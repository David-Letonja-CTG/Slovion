namespace Slovion.Domain.WorldGeneration;

/// <summary>A tile of a map.</summary>
public readonly record struct GridPoint(int X, int Y);

/// <summary>A rectangle of tiles: <see cref="X"/>, <see cref="Y"/> is its top-left tile.</summary>
public readonly record struct GridRect(int X, int Y, int Width, int Height)
{
    public int Right => X + Width - 1;

    public int Bottom => Y + Height - 1;

    public bool Contains(int x, int y) => x >= X && x <= Right && y >= Y && y <= Bottom;

    public bool Contains(GridPoint point) => Contains(point.X, point.Y);

    /// <summary>Whether the tile lies on this rectangle's outer row or column.</summary>
    public bool OnEdge(GridPoint point) => Contains(point) && (point.X == X || point.X == Right || point.Y == Y || point.Y == Bottom);
}

/// <summary>Breadth-first searches over a map's tiles (4 neighbours).</summary>
public static class GridSearch
{
    private static readonly (int Dx, int Dy)[] Steps = [(0, -1), (1, 0), (0, 1), (-1, 0)];

    /// <summary>The four neighbours of a tile that lie inside a <paramref name="width"/> × <paramref name="height"/> map.</summary>
    public static IEnumerable<int> Neighbours(int index, int width, int height)
    {
        var x = index % width;
        var y = index / width;
        foreach (var (dx, dy) in Steps)
        {
            var nx = x + dx;
            var ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < width && ny < height)
            {
                yield return (ny * width) + nx;
            }
        }
    }

    /// <summary>Tiles reachable from <paramref name="start"/> through tiles where <paramref name="passable"/> holds.</summary>
    public static bool[] Reachable(int width, int height, int start, Func<int, bool> passable)
    {
        ArgumentNullException.ThrowIfNull(passable);
        var reached = new bool[width * height];
        if (!passable(start))
        {
            return reached;
        }

        var queue = new Queue<int>();
        queue.Enqueue(start);
        reached[start] = true;
        while (queue.Count > 0)
        {
            var cell = queue.Dequeue();
            foreach (var next in Neighbours(cell, width, height))
            {
                if (!reached[next] && passable(next))
                {
                    reached[next] = true;
                    queue.Enqueue(next);
                }
            }
        }

        return reached;
    }

    /// <summary>
    /// Steps from the nearest source tile to every tile, moving only through tiles where <paramref name="passable"/>
    /// holds; <see cref="int.MaxValue"/> where no source is reachable.
    /// </summary>
    public static int[] Distances(int width, int height, IEnumerable<int> sources, Func<int, bool> passable)
    {
        ArgumentNullException.ThrowIfNull(sources);
        ArgumentNullException.ThrowIfNull(passable);
        var distance = Enumerable.Repeat(int.MaxValue, width * height).ToArray();
        var queue = new Queue<int>();
        foreach (var source in sources)
        {
            if (distance[source] != 0)
            {
                distance[source] = 0;
                queue.Enqueue(source);
            }
        }

        while (queue.Count > 0)
        {
            var cell = queue.Dequeue();
            foreach (var next in Neighbours(cell, width, height))
            {
                if (distance[next] == int.MaxValue && passable(next))
                {
                    distance[next] = distance[cell] + 1;
                    queue.Enqueue(next);
                }
            }
        }

        return distance;
    }

    /// <summary>
    /// The cheapest path (Dijkstra, ties broken by tile index for determinism) from <paramref name="start"/> to any tile
    /// where <paramref name="goal"/> holds, entering a tile costs <paramref name="cost"/> (negative: impassable). Returns
    /// the tiles from start to goal, or <c>null</c> when no goal can be reached.
    /// </summary>
    public static List<int>? CheapestPath(int width, int height, int start, Func<int, bool> goal, Func<int, double> cost)
    {
        ArgumentNullException.ThrowIfNull(goal);
        ArgumentNullException.ThrowIfNull(cost);
        var best = Enumerable.Repeat(double.PositiveInfinity, width * height).ToArray();
        var previous = Enumerable.Repeat(-1, width * height).ToArray();
        var queue = new PriorityQueue<int, (double Cost, int Index)>();
        best[start] = 0;
        queue.Enqueue(start, (0, start));
        while (queue.TryDequeue(out var cell, out var priority))
        {
            if (priority.Cost > best[cell])
            {
                continue;
            }

            if (goal(cell))
            {
                var path = new List<int>();
                for (var at = cell; at != -1; at = previous[at])
                {
                    path.Add(at);
                }

                path.Reverse();
                return path;
            }

            foreach (var next in Neighbours(cell, width, height))
            {
                var step = cost(next);
                if (step < 0)
                {
                    continue;
                }

                var total = best[cell] + step;
                if (total < best[next])
                {
                    best[next] = total;
                    previous[next] = cell;
                    queue.Enqueue(next, (total, next));
                }
            }
        }

        return null;
    }
}
