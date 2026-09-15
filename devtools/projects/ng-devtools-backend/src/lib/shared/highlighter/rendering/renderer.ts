/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {runOutsideAngular} from '../../utils/general';
import {Highlight} from '../types';
import {RenderOp, StaticRenderOp} from './operations';
import {createCanvas, getViewportData, ViewportData} from './utils';

const CANVAS_ID = 'ng-devtools-highlighter-canvas';
const WINDOW_RESIZE_DEBOUNCE = 200;

export class Renderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly operations = new Map<Highlight, RenderOp>();
  private viewportData: ViewportData = getViewportData();
  private resizeObserver!: ResizeObserver;
  private windowResizeCb!: () => void;
  private windowScrollCb!: () => void;
  private renderQueued = false;

  constructor() {
    const {canvas, ctx} = createCanvas(CANVAS_ID);
    this.canvas = canvas;
    this.ctx = ctx;

    this.updateCanvasSize();
    document.body.appendChild(this.canvas);
    this.initEvents();
  }

  renderHighlight(highlight: Highlight) {
    const targetEl = highlight.targetElement.deref();
    if (!targetEl) {
      this.removeHighlight(highlight);
      return;
    }

    const rect = targetEl.getBoundingClientRect();
    let op: RenderOp;

    if (!highlight.template.ttl) {
      op = new StaticRenderOp(this.ctx, highlight.template, rect, this.viewportData);
    } else {
      // TBD DynamicRenderOp; Added for to cover the case
      op = new StaticRenderOp(this.ctx, highlight.template, rect, this.viewportData);
    }

    this.operations.set(highlight, op);
    this.resizeObserver.observe(targetEl);

    this.render();
  }

  removeHighlight(highlight: Highlight) {
    const targetEl = highlight.targetElement.deref();
    if (targetEl) {
      this.resizeObserver.unobserve(targetEl);
    }
    this.operations.delete(highlight);

    this.render();
  }

  destroy() {
    window.removeEventListener('resize', this.windowResizeCb);
    this.resizeObserver.disconnect();
    document.body.removeChild(this.canvas);
  }

  private initEvents() {
    let resizeTimeout: ReturnType<typeof setTimeout>;
    let animationFrameId: ReturnType<typeof requestAnimationFrame>;
    let isWindowResizing = false;

    // Wrap Zone.js monkey-patched code for Zone-based apps.
    runOutsideAngular(() => {
      this.windowResizeCb = () => {
        isWindowResizing = true;
        if (resizeTimeout) {
          clearTimeout(resizeTimeout);
        }
        resizeTimeout = setTimeout(() => {
          requestAnimationFrame(() => {
            this.updateCanvasSize();
            this.updateViewportData();
            this.updateHighlightsRectData();
            this.render();
            isWindowResizing = false;
          });
        }, WINDOW_RESIZE_DEBOUNCE);
      };

      window.addEventListener('resize', this.windowResizeCb);

      this.resizeObserver = new ResizeObserver((entries) => {
        // Ignore events that are already handled by window.resize.
        if (isWindowResizing) {
          return;
        }
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
        animationFrameId = requestAnimationFrame(() => {
          this.updateHighlightsRectData();
          this.render();
        });
      });
    });
  }

  private updateHighlightsRectData() {
    for (const highlight of this.operations.keys()) {
      const targetEl = highlight.targetElement.deref();

      // Get the updated positions of all target elements.
      if (targetEl) {
        const rect = targetEl.getBoundingClientRect();
        const op = this.operations.get(highlight);
        op!.update({rect, viewport: this.viewportData});
      }
    }
  }

  private updateViewportData() {
    this.viewportData = getViewportData();
  }

  private updateCanvasSize() {
    const dpr = window.devicePixelRatio ?? 1;

    // Set the actual scaled size
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;

    // Set the size in CSS (the visual size on the page)
    this.canvas.style.width = `${window.innerWidth}px`;
    this.canvas.style.height = `${window.innerHeight}px`;

    // Normalize the coordinate system to use CSS pixels
    this.ctx.scale(dpr, dpr);
  }

  private render() {
    if (this.renderQueued) {
      return;
    }
    this.renderQueued = true;

    requestAnimationFrame(() => {
      this.ctx.reset();
      console.log('resetting and rendering', Array.from(this.operations));

      for (const op of this.operations.values()) {
        op.render();
      }
      this.renderQueued = false;
    });
  }
}

// const labelContent = this.template.labels[labelId].content(...props);
// // this.props
// // tbd
