/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {AngularDevtoolsError} from '../../utils/error';
import {HighlightTemplate} from '../types';
import {OVERLAY_DEFAULT_OPACITY, OVERLAY_SHADOW_OPACITY} from './consts';

export interface ViewportData {
  width: number;
  height: number;
  scrollX: number;
  scrollY: number;
}

export interface Rect {
  width: number;
  height: number;
  x: number;
  y: number;
}

export function createCanvas(canvasId: string): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  let canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = canvasId;
    canvas.style.position = 'absolute';
    canvas.style.pointerEvents = 'none';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.zIndex = '99999999';
    // TMP
    canvas.style.border = '2px solid red';
    canvas.style.boxSizing = 'border-box';
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new AngularDevtoolsError('Unable to get highlighter canvas rendering context.');
  }

  return {
    canvas,
    ctx,
  };
}

export function getViewportData(): ViewportData {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
  };
}

export function toCSSColor(red: number, green: number, blue: number, alpha = 1): string {
  return `rgba(${red},${green},${blue},${alpha})`;
}

export function getAbsoluteBoundingClientRect(target: Element): Rect {
  const {width, height, x, y} = target.getBoundingClientRect();

  return {
    width,
    height,
    x: x + window.scrollX,
    y: y + window.scrollY,
  };
}

export function drawOverlay(
  ctx: CanvasRenderingContext2D,
  template: HighlightTemplate,
  {x, y, width, height}: Rect,
  opacity = 1,
) {
  const color = toCSSColor(...template.overlayColor, OVERLAY_DEFAULT_OPACITY * opacity);

  switch (template.style) {
    default:
    case 'fill':
      {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, width, height);
      }
      break;
    case 'outline':
      {
        // Outer border
        const outerStroke = 3;
        ctx.lineWidth = outerStroke;
        ctx.strokeStyle = color;
        ctx.strokeRect(x, y, width, height);

        // Inner border
        // We use it instead of a shadow as a less
        // computationally-extensive alternative.
        const pad = outerStroke / 2;
        ctx.lineWidth = 4;
        ctx.strokeStyle = toCSSColor(...template.overlayColor, OVERLAY_SHADOW_OPACITY * opacity);
        ctx.strokeRect(x + pad, y + pad, width - outerStroke, height - outerStroke);
      }
      break;
  }
}
