/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {runOutsideAngular} from '../../utils/general';
import {Highlight} from '../types';
import {CANVAS_ID} from './consts';
import {DynamicTtlBoundHighlightRenderOp, RenderOp, StaticHighlightRenderOp} from './operations';
import {createCanvas, getAbsoluteBoundingClientRect, getViewportData, ViewportData} from './utils';

export class Renderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly operations = new Map<Highlight, RenderOp>();
  private viewportData: ViewportData = getViewportData();
  private elementResizeObserver!: ResizeObserver;
  private cleanUpFn?: () => void;
  private animationFrame?: ReturnType<typeof requestAnimationFrame>;

  constructor() {
    const {canvas, ctx} = createCanvas(CANVAS_ID);
    this.canvas = canvas;
    this.ctx = ctx;

    document.body.appendChild(this.canvas);
    this.updateCanvasSize();
    this.cleanUpFn = this.initEvents();
  }

  private get dpr() {
    return window.devicePixelRatio ?? 1;
  }

  renderHighlight(highlight: Highlight) {
    const targetEl = highlight.targetElement.deref();
    if (!targetEl) {
      this.removeHighlight(highlight);
      return;
    }

    const rect = getAbsoluteBoundingClientRect(targetEl);
    let op: RenderOp;

    if (!highlight.template.ttl) {
      op = new StaticHighlightRenderOp(this.ctx, highlight.template, rect, this.viewportData);
    } else {
      op = new DynamicTtlBoundHighlightRenderOp(
        this.ctx,
        highlight.template,
        rect,
        this.viewportData,
      );
    }

    this.operations.set(highlight, op);
    this.elementResizeObserver.observe(targetEl);

    this.render();
  }

  removeHighlight(highlight: Highlight) {
    const targetEl = highlight.targetElement.deref();
    if (targetEl) {
      this.elementResizeObserver.unobserve(targetEl);
    }
    this.operations.delete(highlight);

    this.render();
  }

  destroy() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    this.cleanUpFn?.();
  }

  private initEvents(): () => void {
    const root = document.documentElement;
    let rootResizeObserver: ResizeObserver;
    let rootMutationObserver: MutationObserver;
    let elementFrame: ReturnType<typeof requestAnimationFrame> = 0;
    let rootFrame: ReturnType<typeof requestAnimationFrame> = 0;
    let lastSize: {width: number; height: number} = {
      width: 0,
      height: 0,
    };

    const rootHandler = () => {
      rootFrame = requestAnimationFrame(() => {
        rootFrame = 0;
        const width = root.scrollWidth;
        const height = root.scrollHeight;
        const {width: lastWidth, height: lastHeight} = lastSize;

        if (width !== lastWidth || height !== lastHeight) {
          this.updateCanvasSize();
          this.updateViewportData();
          this.updateHighlightsRectData();
          this.render();
        }

        lastSize = {width, height};
      });
    };

    // Wrap Zone.js monkey-patched code for Zone-based apps.
    runOutsideAngular(() => {
      rootResizeObserver = new ResizeObserver(rootHandler);
      rootMutationObserver = new MutationObserver(rootHandler);

      rootResizeObserver.observe(root);
      rootResizeObserver.observe(document.body);
      rootMutationObserver.observe(root, {childList: true, subtree: true, attributes: true});

      this.elementResizeObserver = new ResizeObserver(() => {
        if (elementFrame) {
          return;
        }

        elementFrame = requestAnimationFrame(() => {
          elementFrame = 0;
          this.updateHighlightsRectData();
          this.render();
        });
      });
    });

    return () => {
      if (rootFrame) {
        cancelAnimationFrame(rootFrame);
      }
      if (elementFrame) {
        cancelAnimationFrame(elementFrame);
      }
      rootResizeObserver.disconnect();
      rootMutationObserver.disconnect();
      this.elementResizeObserver.disconnect();
    };
  }

  private updateHighlightsRectData() {
    for (const highlight of this.operations.keys()) {
      const targetEl = highlight.targetElement.deref();

      // Get the updated positions of all target elements.
      if (targetEl) {
        const rect = getAbsoluteBoundingClientRect(targetEl);
        const op = this.operations.get(highlight);
        op!.update({rect, viewport: this.viewportData});
      }
    }
  }

  private updateViewportData() {
    this.viewportData = getViewportData();
  }

  private updateCanvasSize() {
    const width = document.documentElement.scrollWidth;
    const height = document.documentElement.scrollHeight;

    // Set the actual scaled size
    this.canvas.width = width * this.dpr;
    this.canvas.height = height * this.dpr;

    // Set the size in CSS (the visual size on the page)
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    // Normalize the coordinate system to use CSS pixels
    this.ctx.scale(this.dpr, this.dpr);
  }

  private clearCanvas() {
    const {width, height} = this.canvas;
    this.ctx.clearRect(0, 0, width / this.dpr, height / this.dpr);
  }

  private render() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    this.animationFrame = requestAnimationFrame((ts) => this.renderFrame(ts));
  }

  private renderFrame(timestamp: number) {
    this.clearCanvas();
    let inProgress = false;

    for (const op of this.operations.values()) {
      op.render(timestamp);
      inProgress ||= op.state === 'in-progress';
    }

    // Continue the render cycle until there are still ops in progress.
    if (inProgress) {
      requestAnimationFrame((ts) => this.renderFrame(ts));
    }
  }
}

// const labelContent = this.template.labels[labelId].content(...props);
