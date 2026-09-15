/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {HighlightTemplate} from '../types';
import {toCSSColor, ViewportData} from './utils';

type RenderJobState = 'non-executed' | 'in-progress' | 'standby';

interface RenderJobUpdate {
  rect?: DOMRect;
  viewport?: ViewportData;
}

export abstract class RenderOp {
  abstract get state(): RenderJobState;
  abstract update(update: RenderJobUpdate): void;
  abstract render(): void | Promise<void>;

  constructor(
    protected readonly ctx: CanvasRenderingContext2D,
    protected readonly template: HighlightTemplate,
    protected rect: DOMRect,
    protected viewport: ViewportData,
  ) {}
}

export class StaticRenderOp extends RenderOp {
  private stateInternal: RenderJobState = 'non-executed';

  constructor(
    ctx: CanvasRenderingContext2D,
    template: HighlightTemplate,
    rect: DOMRect,
    viewport: ViewportData,
  ) {
    super(ctx, template, rect, viewport);
  }

  get state() {
    return this.stateInternal;
  }

  override render() {
    this.stateInternal = 'in-progress';
    this.handleOverlay();
    this.stateInternal = 'standby';
  }

  override update({rect, viewport}: RenderJobUpdate) {
    if (rect) {
      this.rect = rect;
    }
    if (viewport) {
      this.viewport = viewport;
    }
  }

  private handleOverlay() {
    const {x, y, width, height} = this.rect;
    const color = toCSSColor(...this.template.overlayColor, 0.9);

    switch (this.template.style) {
      default:
      case 'fill':
        {
          this.ctx.fillStyle = color;
          this.ctx.fillRect(x, y, width, height);
        }
        break;
      case 'outline':
        {
          this.ctx.lineWidth = 3;
          this.ctx.strokeStyle = color;
          this.ctx.strokeRect(x, y, width, height);
        }
        break;
    }
  }
}
