/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {AngularDevtoolsError} from '../../utils/error';

export interface ViewportData {
  width: number;
  height: number;
  scrollX: number;
  scrollY: number;
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
