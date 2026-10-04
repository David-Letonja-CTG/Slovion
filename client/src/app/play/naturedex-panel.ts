import { DatePipe } from '@angular/common';
import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Action } from '../../engine';
import {
  ApiErrorCode,
  GameApi,
  NatureDexEntry,
  NatureDexSection,
  NatureDexSlot,
  StationInfo,
  apiErrorCode,
} from '../api/game-api';
import { Selection, moveSelection } from './naturedex-selection';

type PanelState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'loaded'; readonly sections: readonly NatureDexSection[] }
  | { readonly kind: 'error'; readonly code: ApiErrorCode };

/** The grid, one opened species (a card while only observed, its page once identified), or the certificates. */
type View =
  | { readonly kind: 'grid' }
  | { readonly kind: 'card' | 'page'; readonly speciesId: string; readonly entry: NatureDexEntry }
  | { readonly kind: 'certificates'; readonly stations: readonly StationInfo[] | null };

/**
 * The NatureDex, shown to players as "Terenski dnevnik" (docs/decisions.md D10): one picture grid per
 * habitat. Keyboard input arrives as UI actions from the play screen; mouse and touch click directly.
 */
@Component({
  selector: 'app-naturedex-panel',
  imports: [DatePipe, TranslocoPipe],
  templateUrl: './naturedex-panel.html',
  styleUrls: ['./overlay.css', './naturedex-panel.css'],
})
export class NatureDexPanel {
  readonly closed = output<void>();
  /** The save no longer exists on the server. */
  readonly saveLost = output<void>();

  protected readonly state = signal<PanelState>({ kind: 'loading' });
  protected readonly view = signal<View>({ kind: 'grid' });
  protected readonly selected = signal<Selection>({ section: 0, index: 0 });
  protected readonly sections = computed(() => {
    const state = this.state();
    return state.kind === 'loaded' ? state.sections : [];
  });
  /** Nothing observed yet: the grid shows only silhouettes, with an encouraging message. */
  protected readonly empty = computed(() =>
    this.sections().every((section) => section.species.every((slot) => slot.entry === null)),
  );

  private readonly pictures = viewChildren<ElementRef<HTMLButtonElement>>('picture');
  private readonly backButton = viewChild<ElementRef<HTMLButtonElement>>('backButton');

  private readonly api = inject(GameApi);

  constructor() {
    this.api.natureDex().subscribe({
      next: ({ habitats }) => this.state.set({ kind: 'loaded', sections: habitats }),
      error: (error: unknown) => {
        const code = apiErrorCode(error);
        if (code === 'invalid_save_token') this.saveLost.emit();
        this.state.set({ kind: 'error', code });
      },
    });

    // Focus follows the selection in the grid and the back button in an opened species, so the
    // visible focus, the shown label and screen readers stay in sync.
    effect(() => {
      if (this.view().kind === 'grid') {
        this.pictures()[this.flatIndex(this.selected())]?.nativeElement.focus();
      } else {
        this.backButton()?.nativeElement.focus();
      }
    });
  }

  /** Keyboard input routed from the play screen while the journal is open. */
  /** The research level as filled and empty stars, e.g. ★★ and ☆ for level 2 of 3. */
  protected stars(level: number | null | undefined): {
    readonly filled: string;
    readonly empty: string;
  } {
    const filled = Math.max(0, Math.min(3, level ?? 0));
    return { filled: '★'.repeat(filled), empty: '☆'.repeat(3 - filled) };
  }

  handleAction(action: Action): void {
    if (this.view().kind !== 'grid') {
      if (action === 'Cancel' || action === 'Confirm') this.back();
      return;
    }

    if (action === 'Cancel') {
      this.closed.emit();
    } else if (action === 'Confirm') {
      const { section, index } = this.selected();
      const slot = this.sections()[section]?.species[index];
      if (slot) this.open(slot);
    } else {
      const sizes = this.sections().map((section) => section.species.length);
      if (sizes.some((size) => size > 0)) {
        this.selected.update((current) => moveSelection(sizes, current, action));
      }
    }
  }

  protected select(section: number, index: number, slot: NatureDexSlot): void {
    this.selected.set({ section, index });
    this.open(slot);
  }

  protected back(): void {
    this.view.set({ kind: 'grid' });
  }

  /** The certificates page: research stations whose goal the save has met (the server decides, D3). */
  protected openCertificates(): void {
    this.view.set({ kind: 'certificates', stations: null });
    this.api.stations().subscribe({
      next: ({ stations }) => {
        if (this.view().kind === 'certificates') {
          this.view.set({
            kind: 'certificates',
            stations: stations.filter((station) => station.met),
          });
        }
      },
      error: (error: unknown) => {
        const code = apiErrorCode(error);
        if (code === 'invalid_save_token') this.saveLost.emit();
        this.state.set({ kind: 'error', code });
      },
    });
  }

  /** The names of a station's fully researched species. */
  protected researchedNames(station: StationInfo): string[] {
    return station.species
      .filter((species) => species.level >= 3 && species.name !== null)
      .map((species) => species.name!);
  }

  protected isSelected(section: number, index: number): boolean {
    const selected = this.selected();
    return selected.section === section && selected.index === index;
  }

  protected identifiedCount(section: NatureDexSection): number {
    return section.species.filter((slot) => slot.status === 'identified').length;
  }

  protected pictureUrl(speciesId: string): string {
    return `/content/species-pictures/${encodeURIComponent(speciesId)}.png`;
  }

  /** Unknown species open nothing; their name stays hidden until identified (D1). */
  private open(slot: NatureDexSlot): void {
    if (slot.entry === null || slot.status === 'unknown') return;
    this.view.set({
      kind: slot.status === 'identified' ? 'page' : 'card',
      speciesId: slot.speciesId,
      entry: slot.entry,
    });
  }

  private flatIndex({ section, index }: Selection): number {
    return (
      this.sections()
        .slice(0, section)
        .reduce((sum, s) => sum + s.species.length, 0) + index
    );
  }
}
