using Microsoft.Extensions.Time.Testing;
using Slovion.Application.Discovery;
using Slovion.Domain.Content;

namespace Slovion.Application.Tests.Discovery;

public class NatureDexServiceTests
{
    private static readonly DateTimeOffset June1 = new(2026, 6, 1, 10, 0, 0, TimeSpan.Zero);
    private static readonly SpeciesId Sage = SpeciesId.Parse("salvia_pratensis");
    private static readonly SpeciesId Dandelion = SpeciesId.Parse("taraxacum_officinale");
    private static readonly SpeciesId Hare = SpeciesId.Parse("lepus_europaeus");
    private readonly FakeTimeProvider time = new(June1);
    private readonly Guid slot = Guid.NewGuid();
    private readonly EncounterService encounters;
    private readonly NatureDexService service;

    private static CancellationToken Token => TestContext.Current.CancellationToken;

    public NatureDexServiceTests()
    {
        var catalog = new FakeContentCatalog(
            FakeContentCatalog.Species("salvia_pratensis", "travniška kadulja"),
            FakeContentCatalog.Species("taraxacum_officinale", "navadni regrat"),
            FakeContentCatalog.Species("lepus_europaeus", "poljski zajec", group: SpeciesGroup.Mammal));

        // Added out of ID order; the hare lives in both; the fox is listed but no longer in content.
        catalog.Habitats.Add(FakeContentCatalog.Habitat("tall_grass", "Visoka trava", "Tall grass", Sage, Dandelion, Hare));
        catalog.Habitats.Add(FakeContentCatalog.Habitat("field_edge", "Rob polja", null, Hare, SpeciesId.Parse("vulpes_vulpes")));

        var discoveries = new InMemoryDiscoveryRepository();
        encounters = new EncounterService(catalog, discoveries, new InMemoryEncounterRepository(), new SeededRandom(1), time);
        service = new NatureDexService(catalog, discoveries);
    }

    private async Task<StartEncounterResult.Started> Observe(string spotId) =>
        Assert.IsType<StartEncounterResult.Started>(await encounters.StartAsync(slot, FakeContentCatalog.MapId, spotId, "sl", Token));

    private async Task Identify(string speciesId)
    {
        var open = await Observe(speciesId);
        await encounters.AnswerAsync(slot, open.Encounter.EncounterId, speciesId, "sl", Token);
    }

    private static NatureDexSlot SlotOf(IReadOnlyList<NatureDexSection> sections, string habitatId, SpeciesId speciesId) =>
        sections.Single(section => section.HabitatId == habitatId).Species.Single(slot => slot.SpeciesId == speciesId);

    [Fact]
    public async Task Sections_follow_habitat_ID_order_and_species_content_order()
    {
        var sections = await service.GetAsync(slot, "sl", Token);

        Assert.Equal(["field_edge", "tall_grass"], sections.Select(section => section.HabitatId));
        Assert.Equal([Sage, Dandelion, Hare], sections[1].Species.Select(s => s.SpeciesId));
        Assert.Equal(["Rob polja", "Visoka trava"], sections.Select(section => section.Name));
    }

    [Fact]
    public async Task A_fresh_save_lists_every_species_as_unknown()
    {
        var sections = await service.GetAsync(slot, "sl", Token);

        Assert.All(sections.SelectMany(section => section.Species), s => Assert.Null(s.Entry));
        Assert.Equal(4, sections.Sum(section => section.Species.Count));
    }

    [Fact]
    public async Task Species_no_longer_in_content_are_skipped()
    {
        var sections = await service.GetAsync(slot, "sl", Token);

        Assert.Equal([Hare], sections[0].Species.Select(s => s.SpeciesId));
    }

    [Fact]
    public async Task Observed_species_carry_an_anonymous_entry()
    {
        await Observe("lepus_europaeus");

        var entry = SlotOf(await service.GetAsync(slot, "sl", Token), "tall_grass", Hare).Entry;

        Assert.NotNull(entry);
        Assert.False(entry.IsIdentified);
        Assert.Equal(SpeciesGroup.Mammal, entry.Group);
        Assert.Equal(June1, entry.ObservedAt);
        Assert.Null(entry.Species);
    }

    [Fact]
    public async Task Identified_entries_list_only_the_sources_their_facts_use()
    {
        await Identify("salvia_pratensis");

        var entry = SlotOf(await service.GetAsync(slot, "sl", Token), "tall_grass", Sage).Entry;

        Assert.NotNull(entry);
        Assert.True(entry.IsIdentified);
        Assert.Equal("travniška kadulja", entry.Species!.Name);
        var source = Assert.Single(entry.Species.Sources);
        Assert.Equal("Title", source.Title);
    }

    [Fact]
    public async Task A_species_in_two_habitats_appears_in_both()
    {
        await Identify("lepus_europaeus");

        var sections = await service.GetAsync(slot, "sl", Token);

        Assert.True(SlotOf(sections, "tall_grass", Hare).Entry?.IsIdentified);
        Assert.True(SlotOf(sections, "field_edge", Hare).Entry?.IsIdentified);
    }

    [Fact]
    public async Task Habitat_names_fall_back_to_Slovenian()
    {
        var sections = await service.GetAsync(slot, "en", Token);

        Assert.Equal(["Rob polja", "Tall grass"], sections.Select(section => section.Name));
    }

    [Fact]
    public async Task Is_per_save_slot()
    {
        await Observe("salvia_pratensis");

        var sections = await service.GetAsync(Guid.NewGuid(), "sl", Token);

        Assert.All(sections.SelectMany(section => section.Species), s => Assert.Null(s.Entry));
    }
}
