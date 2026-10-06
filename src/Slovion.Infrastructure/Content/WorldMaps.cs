using Slovion.Application.Content;
using Slovion.Domain.Saves;

namespace Slovion.Infrastructure.Content;

/// <summary>
/// The maps of a save (D13): authored maps from the catalog, natural ones generated from the save's world seed and kept
/// in a small least-recently-used cache, so a save's map is generated once while it plays (design §1).
/// </summary>
public sealed class WorldMaps(FileContentCatalog catalog) : IWorldMaps
{
    /// <summary>Generated maps kept; a few per active save is plenty (each is ~50 KB).</summary>
    public const int CacheSize = 64;

    private readonly Lock gate = new();
    private readonly Dictionary<(string MapId, long Seed, int Version), LinkedListNode<((string, long, int) Key, SaveMap Map)>> cache = [];
    private readonly LinkedList<((string, long, int) Key, SaveMap Map)> order = [];
    private readonly Dictionary<string, SaveMap> authored = [];

    public SaveMap? Find(SaveSlot save, string mapId)
    {
        ArgumentNullException.ThrowIfNull(save);
        if (catalog.FindMap(mapId) is not { } map)
        {
            return null;
        }

        lock (gate)
        {
            if (map.Template is null)
            {
                if (!authored.TryGetValue(mapId, out var fixedMap))
                {
                    fixedMap = FileContentCatalog.Authored(map);
                    authored[mapId] = fixedMap;
                }

                return fixedMap;
            }

            var key = (mapId, save.WorldSeed, save.WorldVersion);
            if (cache.TryGetValue(key, out var node))
            {
                order.Remove(node);
                order.AddFirst(node);
                return node.Value.Map;
            }
        }

        // Generated outside the lock: two requests for the same new map may both generate it; both get the same result.
        var generated = catalog.Generate(map, save.WorldSeed, save.WorldVersion);
        lock (gate)
        {
            var key = (mapId, save.WorldSeed, save.WorldVersion);
            if (cache.TryGetValue(key, out var existing))
            {
                return existing.Value.Map;
            }

            cache[key] = order.AddFirst((key, generated));
            if (order.Count > CacheSize)
            {
                cache.Remove(order.Last!.Value.Key);
                order.RemoveLast();
            }

            return generated;
        }
    }
}
