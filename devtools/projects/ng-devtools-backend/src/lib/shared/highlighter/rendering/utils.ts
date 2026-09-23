/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {AngularDevtoolsError} from '../../utils/error';
import {
  HighlightLabel,
  HighlightLabelDefinition,
  HighlightLabelProps,
  HighlightTemplate,
  RgbColor,
} from '../types';
import {TEXT_PADDING} from './consts';

export interface Coor {
  x: number;
  y: number;
}

export interface Dimensions {
  width: number;
  height: number;
}

export interface ViewportData extends Dimensions {
  scrollX: number;
  scrollY: number;
}

export type Rect = Coor & Dimensions;

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

export function toCSSColor([red, green, blue]: RgbColor, alpha = 1): string {
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
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
  switch (template.style) {
    default:
    case 'fill':
      {
        ctx.fillStyle = toCSSColor(template.overlayColor, 0.35 * opacity);
        ctx.fillRect(x, y, width, height);
      }
      break;
    case 'outline':
      {
        // Outer border
        const outerStroke = 3;
        ctx.lineWidth = outerStroke;
        ctx.strokeStyle = toCSSColor(template.overlayColor, 0.5 * opacity);
        ctx.strokeRect(x, y, width, height);

        // Inner border
        // We use it instead of a shadow as a less
        // computationally-extensive alternative.
        const pad = outerStroke / 2;
        ctx.lineWidth = 4;
        ctx.strokeStyle = toCSSColor(template.overlayColor, 0.2 * opacity);
        ctx.strokeRect(x + pad, y + pad, width - outerStroke, height - outerStroke);
      }
      break;
  }
}

export function drawLabels(
  ctx: CanvasRenderingContext2D,
  template: HighlightTemplate,
  props: HighlightLabelProps<HighlightLabelDefinition>,
  rect: Rect,
  viewport: ViewportData,
  opacity = 1,
) {
  const color = toCSSColor(template.overlayColor, 0.9 * opacity);
  ctx.font = '11px monospace';

  for (const [name, labelDefinition] of Object.entries(template.labels)) {
    const content = labelDefinition.content(props[name]);

    const labelBoxDim = getLabelDimensions(ctx, content);
    const labelPos = calculateLabelPos(rect, viewport, labelBoxDim.size, labelDefinition);
    if (!labelPos) {
      continue;
    }

    drawLabel(
      ctx,
      content,
      color,
      Object.assign(labelPos, labelBoxDim.size),
      labelBoxDim.fontBoundingBoxAscent,
      opacity,
    );
  }
}

function getLabelDimensions(
  ctx: CanvasRenderingContext2D,
  text: string,
): {size: Dimensions; fontBoundingBoxAscent: number} {
  const m = ctx.measureText(text);
  const w = m.width;
  const h = m.fontBoundingBoxAscent + m.fontBoundingBoxDescent;
  const size = {width: w + TEXT_PADDING * 2, height: h + TEXT_PADDING * 2};

  return {size, fontBoundingBoxAscent: m.fontBoundingBoxAscent};
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  color: string,
  {x, y, width, height}: Rect,
  fontBoundingBoxAscent: number,
  opacity: number,
) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);

  ctx.fillStyle = toCSSColor([255, 255, 255], opacity);
  ctx.fillText(text, x + TEXT_PADDING, y + TEXT_PADDING + fontBoundingBoxAscent);
}

function calculateLabelPos(
  rect: Rect,
  viewport: ViewportData,
  labelSize: Dimensions,
  {offset: labelOffset, x: labelX}: HighlightLabel<any>,
): Coor | null {
  let x = 0;
  let y = 0;

  let insetFallback = false;
  const isInset = labelOffset === 'inset';
  const isStrictInset = labelOffset === 'strict-inset';
  const maxX = viewport.width + viewport.scrollX - labelSize.width;
  const maxY = viewport.height + viewport.scrollY - labelSize.height;

  if (isInset || isStrictInset) {
    const isRectTooSmall = labelSize.width > rect.width || labelSize.height > rect.height;

    if (isRectTooSmall) {
      if (isInset) {
        insetFallback = true;
      } else {
        return null;
      }
    }

    const originY = rect.y + rect.height - labelSize.height;
    y = isInset ? Math.min(originY, maxY) : originY;
  }
  if (labelOffset === 'outset' || insetFallback) {
    y = Math.min(rect.y + rect.height, maxY);
  }

  switch (labelX) {
    case 'left':
      x = Math.min(rect.x, maxX);
      break;
    case 'center':
      x = Math.min(rect.x + (rect.width / 2 - labelSize.width / 2), maxX);
      break;
    case 'right':
      x = Math.min(rect.x + rect.width - labelSize.width, maxX);
  }

  return {x, y};
}
