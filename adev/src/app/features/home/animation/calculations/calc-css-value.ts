/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {
  ColorValue,
  copyParsedValue,
  CssPropertyValue,
  NumericValue,
  TransformValue,
} from '../parsing';

/**
 * Calculate the next `CssPropertyValue` based on the current and a target one.
 *
 * @param currValue The current or active value
 * @param targetValue The target values (it's either the final or the initial value)
 * @param changeRate The change rate relative to the target (i.e. 1 = target value; 0 = current value)
 * @returns The newly generated value
 */
export function calculateNextCssValue<T extends CssPropertyValue = CssPropertyValue>(
  currValue: T,
  targetValue: T,
  changeRate: number,
): T {
  switch (targetValue.type) {
    case 'numeric':
      return calculateNextNumericValue(currValue as NumericValue, targetValue, changeRate) as T;
    case 'transform':
      return calculateNextTransformValue(currValue as TransformValue, targetValue, changeRate) as T;
    case 'color':
      return calculateNextColorValue(currValue as ColorValue, targetValue, changeRate) as T;
  }

  // Should represent static values
  return copyParsedValue(targetValue);
}

function calculateNextNumericValue(
  currValue: NumericValue,
  targetValue: NumericValue,
  changeRate: number,
): NumericValue {
  const nextValue: NumericValue = {
    type: 'numeric',
    values: [],
  };

  for (let i = 0; i < targetValue.values.length; i++) {
    const curr = currValue.values[i];
    const target = targetValue.values[i];
    const numDelta = calculateValueDelta(curr[0], target[0], changeRate);
    nextValue.values.push([curr[0] + numDelta, target[1]]);
  }

  return nextValue;
}

function calculateNextTransformValue(
  currValue: TransformValue,
  targetValue: TransformValue,
  changeRate: number,
): TransformValue {
  const nextValue: TransformValue = {
    type: 'transform',
    values: new Map(),
  };

  for (const [func, numData] of Array.from(targetValue.values)) {
    const currNumData = currValue.values.get(func)!; // !!!
    const newNumData: [number, string][] = [];

    for (let i = 0; i < numData.length; i++) {
      const target = numData[i];
      const curr = currNumData[i];
      const numDelta = calculateValueDelta(curr[0], target[0], changeRate);
      newNumData.push([curr[0] + numDelta, target[1]]);
    }

    nextValue.values.set(func, newNumData);
  }

  return nextValue;
}

function calculateNextColorValue(
  currValue: ColorValue,
  targetValue: ColorValue,
  changeRate: number,
): ColorValue {
  if (targetValue.value.length !== 7) {
    return targetValue;
  }

  let currHexChannel = '';
  let targetHexChannel = '';
  let nextHexColor = '#';

  for (let i = 1; i < targetValue.value.length; i++) {
    currHexChannel += currValue.value[i];
    targetHexChannel += targetValue.value[i];

    if (targetHexChannel.length === 2) {
      const currRgbChannel = parseInt(currHexChannel, 16);
      const targetRgbChannel = parseInt(targetHexChannel, 16);
      const delta = calculateValueDelta(currRgbChannel, targetRgbChannel, changeRate);
      const nextRgbChannel = Math.round(currRgbChannel + delta);

      nextHexColor += nextRgbChannel.toString(16).padStart(2, '0');

      currHexChannel = '';
      targetHexChannel = '';
    }
  }

  return {
    type: 'color',
    value: nextHexColor,
  };
}

function calculateValueDelta(currValue: number, targetValue: number, changeRate: number): number {
  const valueSpan = targetValue - currValue;
  return valueSpan * changeRate;
}
