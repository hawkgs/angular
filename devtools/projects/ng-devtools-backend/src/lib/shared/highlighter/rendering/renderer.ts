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

const WINDOW_RESIZE_DEBOUNCE = 200;

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

    highlight.props;

    if (!highlight.template.ttl) {
      op = new StaticHighlightRenderOp(
        this.ctx,
        highlight.template,
        highlight.props,
        rect,
        this.viewportData,
      );
    } else {
      op = new DynamicTtlBoundHighlightRenderOp(
        this.ctx,
        highlight.template,
        highlight.props,
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
    let scrollTimeout: ReturnType<typeof setTimeout>;
    let lastSize: {width: number; height: number} = {
      width: 0,
      height: 0,
    };

    const rootUpdatesHandler = () => {
      rootFrame = requestAnimationFrame(() => {
        rootFrame = 0;
        const width = root.scrollWidth;
        const height = root.scrollHeight;
        const {width: lastWidth, height: lastHeight} = lastSize;

        if (width !== lastWidth || height !== lastHeight) {
          this.updateCanvasSize();
          this.updateViewportData();
          this.updateHighlightsData('full');
          this.render();
        }

        lastSize = {width, height};
      });
    };

    const scrollHandler = () => {
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      scrollTimeout = setTimeout(() => {
        requestAnimationFrame(() => {
          this.updateViewportData();
          this.updateHighlightsData('viewport');
          this.render();
        });
      }, WINDOW_RESIZE_DEBOUNCE);
    };

    // Wrap Zone.js monkey-patched code for Zone-based apps.
    runOutsideAngular(() => {
      rootResizeObserver = new ResizeObserver(rootUpdatesHandler);
      rootMutationObserver = new MutationObserver(rootUpdatesHandler);

      rootResizeObserver.observe(root);
      rootResizeObserver.observe(document.body);
      rootMutationObserver.observe(root, {childList: true, subtree: true, attributes: true});

      window.addEventListener('scroll', scrollHandler);

      this.elementResizeObserver = new ResizeObserver(() => {
        if (elementFrame) {
          return;
        }

        elementFrame = requestAnimationFrame(() => {
          elementFrame = 0;
          this.updateHighlightsData('full');
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
      window.removeEventListener('scroll', scrollHandler);
    };
  }

  private updateHighlightsData(config: 'full' | 'viewport') {
    const fullData = config === 'full';

    for (const highlight of this.operations.keys()) {
      const targetEl = highlight.targetElement.deref();

      // Get the updated positions of all target elements.
      if (targetEl) {
        const rect = fullData ? getAbsoluteBoundingClientRect(targetEl) : undefined;
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
