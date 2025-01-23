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
    // We should check both curr and target for the unit
    // since we might have zero-based value without a unit
    // (e.g. 0 <-> 640px)
    const unit = target[1] || curr[1];
    nextValue.values.push([curr[0] + numDelta, unit]);
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
      // We should check both curr and target for the unit
      // since we might have zero-based value without a unit
      // (e.g. rotate(0) <-> rotate(180deg))
      const unit = target[1] || curr[1];
      newNumData.push([curr[0] + numDelta, unit]);
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
  const nextColor: (string | number)[] = [currValue.value[0]];

  for (let i = 1; i < targetValue.value.length; i++) {
    const currChannel = currValue.value[i] as number;
    const targetChannel = targetValue.value[i] as number;
    const delta = calculateValueDelta(currChannel, targetChannel, changeRate);
    nextColor.push(Math.round(currChannel + delta));
  }

  return {
    type: 'color',
    value: nextColor as typeof currValue.value,
  };
}

function calculateValueDelta(currValue: number, targetValue: number, changeRate: number): number {
  const valueSpan = targetValue - currValue;
  return valueSpan * changeRate;
}
