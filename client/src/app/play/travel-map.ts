import {
  Component,
  ElementRef,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  viewChildren,
} from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Action } from '../../engine';
import { RegionInfo } from '../api/game-api';

/**
 * The travel map opened at a signpost: a schematic map of Slovenia with every region, and the list of regions.
 * Keyboard input arrives as UI actions from the play screen: `MoveUp`/`MoveDown` select, `Confirm` travels to
 * the selected open region, `Cancel` closes. Locked regions and the current one cannot be chosen.
 */
@Component({
  selector: 'app-travel-map',
  imports: [TranslocoPipe],
  templateUrl: './travel-map.html',
  styleUrls: ['./overlay.css', './travel-map.css'],
})
export class TravelMap {
  readonly regions = input.required<readonly RegionInfo[]>();
  readonly currentRegionId = input.required<string>();
  /** An open region other than the current one was chosen; the host asks the server to travel (D3). */
  readonly chosen = output<RegionInfo>();
  readonly closed = output<void>();

  /** The selected list entry; it starts on the current region. */
  protected readonly selected = linkedSignal(() =>
    Math.max(
      0,
      this.regions().findIndex((region) => region.regionId === this.currentRegionId()),
    ),
  );
  private readonly options = viewChildren<ElementRef<HTMLButtonElement>>('option');
  private readonly plural = new Intl.PluralRules(inject(TranslocoService).getActiveLang());

  constructor() {
    // Focus follows the selection, so Enter and screen readers act on the selected region.
    effect(() => this.options()[this.selected()]?.nativeElement.focus());
  }

  /** Keyboard input routed from the play screen while the map is open. */
  handleAction(action: Action): void {
    const last = this.regions().length - 1;
    if (action === 'MoveUp') this.selected.update((i) => Math.max(0, i - 1));
    if (action === 'MoveDown') this.selected.update((i) => Math.min(last, i + 1));
    if (action === 'Confirm') this.choose(this.selected());
    if (action === 'Cancel') this.closed.emit();
  }

  protected choose(index: number): void {
    const region = this.regions()[index];
    this.selected.set(index);
    if (region && this.canTravel(region)) this.chosen.emit(region);
  }

  protected canTravel(region: RegionInfo): boolean {
    return region.unlocked && region.regionId !== this.currentRegionId();
  }

  /** t(travel.current, travel.open, travel.locked) */
  protected stateKey(region: RegionInfo): string {
    if (region.regionId === this.currentRegionId()) return 'travel.current';
    return region.unlocked ? 'travel.open' : 'travel.locked';
  }

  /** How many more species a locked count region needs, if it has a count rule. */
  protected remaining(region: RegionInfo): number | undefined {
    if (region.unlocked || region.required === null || region.identified === null) return undefined;
    return Math.max(1, region.required - region.identified);
  }

  /** t(travel.remaining.one, travel.remaining.two, travel.remaining.few, travel.remaining.other) */
  protected remainingKey(count: number): string {
    const category = this.plural.select(count);
    return `travel.remaining.${['one', 'two', 'few'].includes(category) ? category : 'other'}`;
  }
}
