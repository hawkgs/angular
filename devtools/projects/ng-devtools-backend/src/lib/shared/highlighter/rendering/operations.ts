/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {HighlightLabelDefinition, HighlightLabelProps, HighlightTemplate} from '../types';
import {drawLabels, drawOverlay, Rect, setCanvasOpacity, ViewportData} from './utils';

export const OVERLAY_FADE_OUT_DUR = 300;

type RenderOpState = 'non-executed' | 'in-progress' | 'standby';

interface RenderOpUpdate {
  rect?: Rect;
  viewport?: ViewportData;
}

export abstract class RenderOp {
  abstract render(timestamp: number): void;

  protected stateInternal: RenderOpState = 'non-executed';
  protected start: number = -1;

  constructor(
    protected readonly ctx: CanvasRenderingContext2D,
    protected readonly template: HighlightTemplate,
    protected readonly props: HighlightLabelProps<HighlightLabelDefinition>,
    protected rect: Rect,
    protected viewport: ViewportData,
  ) {}

  get state() {
    return this.stateInternal;
  }

  get isVisible() {
    const rect = this.rect;
    const viewport = this.viewport;

    return (
      rect.y < viewport.height + viewport.scrollY && rect.x < viewport.width + viewport.scrollX
    );
  }

  update({rect, viewport}: RenderOpUpdate) {
    if (rect) {
      this.rect = rect;
    }
    if (viewport) {
      this.viewport = viewport;
    }
  }
}

/** Use for static highlights that don't have a TTL. */
export class StaticHighlightRenderOp extends RenderOp {
  render(timestamp: number) {
    if (!this.isVisible) {
      return;
    }

    this.start = timestamp;
    setCanvasOpacity(this.ctx, 1);
    drawOverlay(this.ctx, this.template, this.rect);
    drawLabels(this.ctx, this.template, this.props, this.rect, this.viewport);
    this.stateInternal = 'standby';
  }
}

/** Use for TTL-based highlights ONLY. */
export class DynamicTtlBoundHighlightRenderOp extends RenderOp {
  private readonly fadeOutStart = this.template.ttl! - OVERLAY_FADE_OUT_DUR;

  render(timestamp: number) {
    if (!this.isVisible) {
      return;
    }

    if (this.start === -1) {
      this.start = timestamp;
      this.stateInternal = 'in-progress';
    }

    const timePassed = timestamp - this.start;
    // Calculate the diff between the fade out start TS and the passed time.
    const fadeOutTimePassDiff = timePassed - this.fadeOutStart;
    let opacity: number;

    if (fadeOutTimePassDiff < 0) {
      opacity = 1;
    } else {
      const progress = Math.min(fadeOutTimePassDiff / OVERLAY_FADE_OUT_DUR, 1);
      // We have to invert the progress since we want to fade out, not fade in.
      opacity = 1 - progress;
    }

    setCanvasOpacity(this.ctx, opacity);
    drawOverlay(this.ctx, this.template, this.rect);
    drawLabels(this.ctx, this.template, this.props, this.rect, this.viewport);

    if (timePassed >= this.template.ttl!) {
      this.stateInternal = 'standby';
    }
  }
}
