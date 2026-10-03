using Slovion.Application.Content;
using Slovion.Domain.Content;

namespace Slovion.Infrastructure.Content;

/// <summary>Tool loading and validation: every tool is a start tool or some quest's reward.</summary>
public sealed partial class FileContentCatalog
{
    private const int ItemIconSize = 16;

    /// <summary>Content folder with a 16×16 icon per tool, served to clients as-is.</summary>
    public const string ItemIconsFolder = "item-icons";

    private static List<Item> LoadItems(string folder, List<string> errors)
    {
        var result = new List<Item>();
        foreach (var file in JsonFiles(folder))
        {
            var name = $"items/{Path.GetFileName(file)}";
            var item = Read<ItemFile>(file, name, errors);
            if (item is null)
            {
                continue;
            }

            var errorCount = errors.Count;
            if (item.Id is null || !MapIdPattern().IsMatch(item.Id))
            {
                errors.Add($"{name}: invalid tool ID '{item.Id}' (expected lowercase snake_case).");
            }

            var texts = new Dictionary<string, ItemText>(StringComparer.Ordinal);
            foreach (var (language, text) in item.Text ?? [])
            {
                if (string.IsNullOrWhiteSpace(text?.Name) || string.IsNullOrWhiteSpace(text.Description))
                {
                    errors.Add($"{name}: 'text.{language}' needs a 'name' and a 'description'.");
                }
                else
                {
                    texts[language] = new ItemText(text.Name, text.Description);
                }
            }

            if (item.Text is null || !item.Text.ContainsKey(IContentCatalog.DefaultLanguage))
            {
                errors.Add($"{name}: Slovenian text ('text.{IContentCatalog.DefaultLanguage}') is required.");
            }

            if (errors.Count > errorCount)
            {
                continue;
            }

            if (result.Any(existing => existing.Id == item.Id))
            {
                errors.Add($"{name}: duplicate tool ID '{item.Id}'.");
                continue;
            }

            result.Add(new Item(item.Id!, item.Start ?? false, texts));
        }

        return result;
    }

    /// <summary>Every tool that saves do not start with is some quest's reward, so it can be obtained.</summary>
    private static void ValidateItemRewards(List<Item> items, Dictionary<string, Quest> quests, List<string> errors)
    {
        foreach (var item in items.Where(item => !item.IsStart))
        {
            if (!quests.Values.Any(quest => quest.RewardItems?.Contains(item.Id) == true))
            {
                errors.Add($"items/{item.Id}.json: tool '{item.Id}' is neither a start tool nor any quest's reward.");
            }
        }
    }
}
