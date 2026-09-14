/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {EventEmitter} from '@angular/core';
import {AngularDevtoolsError} from '../utils/error';
import {runOutsideAngular} from '../utils/general';
import {debugLog} from '../utils/log';
import {
  fadeOutOverlay,
  OVERLAY_FADE_OUT_DUR,
  positionOverlayElement,
  setLabelElementPosition,
} from './dom';

type LabelContentFn = (...props: any[]) => Element | string;
export type HighlightLabelDefinition = Record<string, LabelContentFn>;

export type RgbColor = readonly [red: number, green: number, blue: number];

export type HighlightLabelProps<T extends HighlightLabelDefinition> = Record<
  keyof T,
  Parameters<T[keyof T]>
>;

export interface HighlightLabel<T extends LabelContentFn> {
  /** X axis position. */
  x: 'left' | 'center' | 'right';

  /** Offset placement of the label relative to the highlight container edge. */
  offset: 'inset' | 'outset' | 'prefer-inset';

  /** Label content template function. */
  content: T;
}

export interface HighlightTemplate<T extends HighlightLabelDefinition = HighlightLabelDefinition> {
  /** Highlight type. */
  type: HighlightType;

  /** Color of the highlight overlay. The labels are also based on it. */
  overlayColor: RgbColor;

  /** Select the style of the overlay – filled or an outline. Default: `fill` */
  style?: 'fill' | 'outline';

  /**
   * Pick whether the labels should be visible/sticky
   * or static relative to X axis.
   */
  labelsType: 'sticky' | 'static';

  /**
   * Represents all labels of the highlight.
   * NOTE: A highlight can have a single label per position
   * (e.g. a single `left`, a single `center` and a single `right`).
   */
  labels: Record<keyof T, HighlightLabel<T[keyof T]>>;

  /** Time to live (in milliseconds). Default: unset */
  ttl?: number;
}

// Add a new type for each new template.
//
// WARNING: The enum numeric value matters. It's used for establishing
// a priority when a single target element has multiple highlights.
// The smaller the number, the higher the priority.
export enum HighlightType {
  ChangeDetection = 0,
  InspectElement = 1,
  HydrationSkipped = 2,
  HydrationMismatched = 3,
  HydrationCompleted = 4,
}

/** Provides a container of all highlight-related references and controls over the highlight. */
export class Highlight<T extends HighlightLabelDefinition = HighlightLabelDefinition> {
  readonly targetElement: WeakRef<Element>;
  private destroyed = false;
  private ttlTimeout: ReturnType<typeof setTimeout> = 0;

  constructor(
    targetElement: Element,
    private readonly overlayElement: HTMLElement,
    private readonly labelElements: Record<keyof T, HTMLElement>,
    private readonly template: HighlightTemplate<T>,
    private readonly destroyEvents: EventEmitter<[highlight: Highlight]>,
  ) {
    validateTemplateLabels(template);
    this.targetElement = new WeakRef(targetElement);
  }

  get type() {
    return this.template.type;
  }

  get isDestroyed() {
    return this.destroyed;
  }

  /** Update a label of the highlight. */
  updateLabel(labelId: keyof T, ...props: Parameters<T[keyof T]>) {
    const labelContent = this.template.labels[labelId].content(...props);
    const labelElement = this.labelElements[labelId];

    if (typeof labelContent === 'string') {
      labelElement.textContent = labelContent;
    } else {
      labelElement.replaceChildren(labelContent);
    }
  }

  /**
   * Remove the highlight.
   */
  destroy() {
    // Since there is a chance that there are references
    // outside of `highlighter.ts`, we store the destroy state.
    // Ideally, we should clean up all references.
    // Getting the warning, means that there MIGHT be a problem
    // with the code (i.e. there is chance for a memory leak).
    // However, this could be a false positive since GC passes
    // are not guaranteed to happen immediately.
    // This is merely a warning to be diligent with references storing.
    if (this.destroyed) {
      debugLog.warn('The highlight has already been destroyed. Check references storing.');
      return;
    }
    if (this.ttlTimeout) {
      clearTimeout(this.ttlTimeout);
      this.ttlTimeout = 0;
    }
    this.destroyEvents.emit([this]);
    this.overlayElement.remove();
    this.destroyed = true;
  }

  /** Render/append the highlight to the DOM. */
  display() {
    if (document.body.contains(this.overlayElement)) {
      return;
    }
    if (this.destroyed) {
      debugLog.warn('Cannot display a destroyed highlight.');
      return;
    }

    document.body.appendChild(this.overlayElement);

    // Initiate TTL, if it's set
    const {ttl} = this.template;
    if (ttl !== undefined && ttl > 0 && !this.ttlTimeout) {
      runOutsideAngular(() => {
        this.ttlTimeout = setTimeout(() => this.destroy(), ttl);
      });

      // Check whether there is enough time to fade out the
      // element gracefully. If not, do not animate.
      const timeUntilFadeOut = ttl - OVERLAY_FADE_OUT_DUR;
      if (timeUntilFadeOut >= 0) {
        fadeOutOverlay(this.overlayElement, timeUntilFadeOut);
      }
    }
  }

  /** Remove the highlight from the DOM. */
  hide() {
    if (document.body.contains(this.overlayElement)) {
      document.body.removeChild(this.overlayElement);
    }
  }

  /**
   * Position the highlight by a provided `DOMRect`.
   * If omitted, the current bounding client rect of the target element will be used.
   */
  position(dimensions: DOMRect) {
    positionOverlayElement(dimensions, this.overlayElement);

    for (const [id, label] of Object.entries(this.labelElements)) {
      setLabelElementPosition(dimensions, label, this.template.labels[id].offset);
    }
  }
}

function validateTemplateLabels(template: HighlightTemplate) {
  const usedXPos = new Set<string>();

  for (const {x} of Object.values(template.labels)) {
    if (usedXPos.has(x)) {
      throw new AngularDevtoolsError(
        `The template (type: ${template.type}) has multiple labels with '${x}' X position.`,
      );
    }
    usedXPos.add(x);
  }
}
