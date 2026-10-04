using System.Text.RegularExpressions;
using Slovion.Application.Content;
using Slovion.Domain.Content;

namespace Slovion.Infrastructure.Content;

/// <summary>NPC, quest and map-actor (NPC, gate and signpost) loading and validation.</summary>
public sealed partial class FileContentCatalog
{
    /// <summary>Dialogue placeholders the server fills in.</summary>
    private static readonly string[] Placeholders = ["{identified}", "{goal}"];

    private static Dictionary<string, Npc> LoadNpcs(string folder, List<string> errors)
    {
        var result = new Dictionary<string, Npc>(StringComparer.Ordinal);
        foreach (var file in JsonFiles(folder))
        {
            var name = $"npcs/{Path.GetFileName(file)}";
            var npc = Read<NpcFile>(file, name, errors);
            if (npc is null)
            {
                continue;
            }

            var errorCount = errors.Count;
            if (npc.Id is null || !MapIdPattern().IsMatch(npc.Id))
            {
                errors.Add($"{name}: invalid NPC ID '{npc.Id}' (expected lowercase snake_case).");
            }

            var names = new Dictionary<string, string>(StringComparer.Ordinal);
            foreach (var (language, text) in npc.Text ?? [])
            {
                if (string.IsNullOrWhiteSpace(text?.Name))
                {
                    errors.Add($"{name}: 'text.{language}.name' is missing.");
                }
                else
                {
                    names[language] = text.Name;
                }
            }

            if (npc.Text is null || !npc.Text.ContainsKey(IContentCatalog.DefaultLanguage))
            {
                errors.Add($"{name}: Slovenian name ('text.{IContentCatalog.DefaultLanguage}.name') is required.");
            }

            if (errors.Count == errorCount && !result.TryAdd(npc.Id!, new Npc(npc.Id!, names)))
            {
                errors.Add($"{name}: duplicate NPC ID '{npc.Id}'.");
            }
        }

        return result;
    }

    private static Dictionary<string, Quest> LoadQuests(string folder, Dictionary<string, Npc> npcs, Dictionary<string, Habitat> habitats, List<Item> items, List<string> errors)
    {
        var result = new Dictionary<string, Quest>(StringComparer.Ordinal);
        foreach (var file in JsonFiles(folder))
        {
            var name = $"quests/{Path.GetFileName(file)}";
            var quest = Read<QuestFile>(file, name, errors);
            if (quest is null)
            {
                continue;
            }

            var errorCount = errors.Count;
            if (quest.Id is null || !MapIdPattern().IsMatch(quest.Id))
            {
                errors.Add($"{name}: invalid quest ID '{quest.Id}' (expected lowercase snake_case).");
            }

            if (quest.Giver is null || !npcs.ContainsKey(quest.Giver))
            {
                errors.Add($"{name}: quest '{quest.Id}' is given by unknown NPC '{quest.Giver}'.");
            }

            if (quest.Goal is not { IdentifiedSpecies: > 0 })
            {
                errors.Add($"{name}: 'goal.identifiedSpecies' must be a positive integer.");
            }

            if (quest.Goal?.Habitat is { } habitatId && (!habitats.TryGetValue(habitatId, out var habitat) || habitat.Species.Count < quest.Goal.IdentifiedSpecies))
            {
                errors.Add($"{name}: 'goal.habitat' must be a habitat listing at least {quest.Goal.IdentifiedSpecies} species (found '{habitatId}').");
            }

            foreach (var itemId in (quest.Reward?.Items ?? []).Where(itemId => !items.Any(item => item.Id == itemId)))
            {
                errors.Add($"{name}: quest '{quest.Id}' rewards unknown tool '{itemId}'.");
            }

            if (quest.Reward?.Flag is not { } flag || !MapIdPattern().IsMatch(flag))
            {
                errors.Add($"{name}: 'reward.flag' must be a lowercase snake_case flag ID (found '{quest.Reward?.Flag}').");
            }

            var texts = new Dictionary<string, QuestText>(StringComparer.Ordinal);
            foreach (var (language, text) in quest.Text ?? [])
            {
                var validated = ValidateQuestText(text, $"{name}: text.{language}", errors);
                if (validated is not null)
                {
                    texts[language] = validated;
                }
            }

            if (quest.Text is null || !quest.Text.ContainsKey(IContentCatalog.DefaultLanguage))
            {
                errors.Add($"{name}: Slovenian text ('text.{IContentCatalog.DefaultLanguage}') is required.");
            }

            if (errors.Count > errorCount)
            {
                continue;
            }

            var loaded = new Quest(quest.Id!, quest.Giver!, quest.Goal!.IdentifiedSpecies, quest.Reward!.Flag!, texts, quest.Goal.Habitat, quest.Reward.Items);
            if (!result.TryAdd(loaded.Id, loaded))
            {
                errors.Add($"{name}: duplicate quest ID '{loaded.Id}'.");
            }
        }

        return result;
    }

    private static QuestText? ValidateQuestText(QuestTextFile? text, string at, List<string> errors)
    {
        var errorCount = errors.Count;
        foreach (var (field, value) in new[] { ("title", text?.Title), ("summary", text?.Summary), ("returnHint", text?.ReturnHint) })
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                errors.Add($"{at}.{field} is missing.");
            }
        }

        var dialogue = new Dictionary<QuestDialogue, IReadOnlyList<string>>();
        foreach (var (state, lines) in new[]
        {
            (QuestDialogue.Offer, text?.Dialogue?.Offer),
            (QuestDialogue.Active, text?.Dialogue?.Active),
            (QuestDialogue.Ready, text?.Dialogue?.Ready),
            (QuestDialogue.Completed, text?.Dialogue?.Completed),
        })
        {
            var key = $"{at}.dialogue.{char.ToLowerInvariant(state.ToString()[0])}{state.ToString()[1..]}";
            if (lines is null || lines.Count == 0 || lines.Any(string.IsNullOrWhiteSpace))
            {
                errors.Add($"{key} needs at least one line and no empty lines.");
                continue;
            }

            foreach (var unknown in lines.SelectMany(line => PlaceholderPattern().Matches(line)).Select(match => match.Value).Where(value => !Placeholders.Contains(value)).Distinct())
            {
                errors.Add($"{key} uses unknown placeholder '{unknown}' (allowed: {string.Join(", ", Placeholders)}).");
            }

            dialogue[state] = lines;
        }

        return errors.Count > errorCount ? null : new QuestText(text!.Title!, text.Summary!, text.ReturnHint!, dialogue);
    }

    /// <summary>In the current scope every NPC gives exactly one quest.</summary>
    private static void ValidateQuestGivers(Dictionary<string, Npc> npcs, Dictionary<string, Quest> quests, List<string> errors)
    {
        foreach (var npc in npcs.Keys.Order(StringComparer.Ordinal))
        {
            var count = quests.Values.Count(quest => quest.GiverId == npc);
            if (count != 1)
            {
                errors.Add($"npcs/{npc}.json: NPC '{npc}' must give exactly one quest (found {count}).");
            }
        }
    }

    /// <summary>
    /// NPCs, gates, the signpost and research stations: Tiled tile objects (with a <c>gid</c>) whose position is their bottom-left corner.
    /// Each covers the tile under its centre. Every map has exactly one signpost, which opens the travel map.
    /// </summary>
    private static List<MapNpc> ValidateMapActors(TiledMapFile map, string mapId, string name, Dictionary<string, Npc> npcs, IReadOnlySet<string> rewardFlags, List<string> errors)
    {
        var result = new List<MapNpc>();
        var objects = map.Layers?.FirstOrDefault(l => l.Name == "objects" && l.Type == "objectgroup")?.Objects ?? [];
        var signposts = objects.Count(o => o.ObjectClass == "signpost");
        if (signposts != 1)
        {
            errors.Add($"{name}: exactly one 'signpost' object is required (found {signposts}).");
        }

        foreach (var actor in objects.Where(o => o.ObjectClass is "npc" or "gate" or "signpost" or "station"))
        {
            var isNpc = actor.ObjectClass == "npc";
            var at = $"{name}: {actor.ObjectClass} '{actor.Name}'";
            var tileX = (int)Math.Floor((actor.X + (actor.Width / 2)) / TileSize);
            var tileY = (int)Math.Floor((actor.Y - (actor.Height / 2)) / TileSize);
            if (actor.Gid <= 0)
            {
                errors.Add($"{at} must be a tile object (with a 'gid').");
            }

            if (tileX < 0 || tileY < 0 || tileX >= map.Width || tileY >= map.Height)
            {
                errors.Add($"{at} lies outside the map.");
            }

            if (isNpc)
            {
                var npcId = actor.StringProperty("npcId");
                if (npcId is null || !npcs.TryGetValue(npcId, out var npc))
                {
                    errors.Add($"{at} refers to unknown NPC '{npcId}'.");
                }
                else if (result.Any(placed => placed.Npc.Id == npcId))
                {
                    errors.Add($"{at}: NPC '{npcId}' is placed more than once.");
                }
                else
                {
                    result.Add(new MapNpc(mapId, npc));
                }
            }
            else if (actor.ObjectClass == "gate" && (actor.StringProperty("requiresFlag") is not { } flag || !rewardFlags.Contains(flag)))
            {
                errors.Add($"{at} requires flag '{actor.StringProperty("requiresFlag")}', which no quest rewards.");
            }
        }

        return result;
    }

    [GeneratedRegex(@"\{[^}]*\}")]
    private static partial Regex PlaceholderPattern();
}
