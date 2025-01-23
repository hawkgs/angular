/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {calculateNextCssValue} from './calc-css-value';
import {ColorValue, NumericValue, StaticValue, TransformValue} from '../parsing';

//
// Test values
//

const currentNumeric: NumericValue = {
  type: 'numeric',
  values: [
    [100, 'px'],
    [250, 'px'],
  ],
};

const targetNumeric: NumericValue = {
  type: 'numeric',
  values: [
    [125, 'px'],
    [100, 'px'],
  ],
};

const currentTransform: TransformValue = {
  type: 'transform',
  values: new Map([
    [
      'transform',
      [
        [100, 'px'],
        [10, 'px'],
      ],
    ],
    ['scale', [[0.5, '']]],
  ]),
};

const targetTransform: TransformValue = {
  type: 'transform',
  values: new Map([
    [
      'transform',
      [
        [150, 'px'],
        [5, 'px'],
      ],
    ],
    ['scale', [[1, '']]],
  ]),
};

const currentColor: ColorValue = {
  type: 'color',
  value: ['rgb', 0, 0, 0],
};

const targetColor: ColorValue = {
  type: 'color',
  value: ['rgb', 255, 255, 255],
};

//
// Tests
//

describe('calculateNextCssValue', () => {
  it('should return the target value, if static', () => {
    const current: StaticValue = {
      type: 'static',
      value: '1px solid red',
    };
    const target: StaticValue = {
      type: 'static',
      value: '2px solid blue',
    };
    const next = calculateNextCssValue(current, target, 0.5);

    expect(next).toEqual(target);
  });

  it('should return the current numeric value, if the change rate is 0', () => {
    const next = calculateNextCssValue(currentNumeric, targetNumeric, 0);

    expect(next).toEqual(currentNumeric);
  });

  it('should return the target numeric value, if the change rate is 1', () => {
    const next = calculateNextCssValue(currentNumeric, targetNumeric, 1);

    expect(next).toEqual(targetNumeric);
  });

  it('should calculate a numeric value', () => {
    const next = calculateNextCssValue(currentNumeric, targetNumeric, 0.75);

    expect(next).toEqual({
      type: 'numeric',
      values: [
        [118.75, 'px'],
        [137.5, 'px'],
      ],
    });
  });

  it('should handle numeric zero values without units', () => {
    const current: NumericValue = {
      type: 'numeric',
      values: [[100, '%']],
    };
    const target: NumericValue = {
      type: 'numeric',
      values: [[0, '']],
    };
    const next = calculateNextCssValue(current, target, 0.25);

    expect(next).toEqual({
      type: 'numeric',
      values: [[75, '%']],
    });
  });

  it('should return the current transform value, if the change rate is 0', () => {
    const next = calculateNextCssValue(currentTransform, targetTransform, 0);

    expect(next).toEqual(currentTransform);
  });

  it('should return the target transform value, if the change rate is 1', () => {
    const next = calculateNextCssValue(currentTransform, targetTransform, 1);

    expect(next).toEqual(targetTransform);
  });

  it('should calculate a transform value', () => {
    const next = calculateNextCssValue(currentTransform, targetTransform, 0.75);

    expect(next).toEqual({
      type: 'transform',
      values: new Map([
        [
          'transform',
          [
            [137.5, 'px'],
            [6.25, 'px'],
          ],
        ],
        ['scale', [[0.875, '']]],
      ]),
    });
  });

  it('should handle transform zero values without units', () => {
    const current: TransformValue = {
      type: 'transform',
      values: new Map([['translateX', [[120, 'px']]]]),
    };
    const target: TransformValue = {
      type: 'transform',
      values: new Map([['translateX', [[0, '']]]]),
    };
    const next = calculateNextCssValue(current, target, 0.25);

    expect(next).toEqual({
      type: 'transform',
      values: new Map([['translateX', [[90, 'px']]]]),
    });
  });

  it('should return the current color value, if the change rate is 0', () => {
    const next = calculateNextCssValue(currentColor, targetColor, 0);

    expect(next).toEqual(currentColor);
  });

  it('should return the target color value, if the change rate is 1', () => {
    const next = calculateNextCssValue(currentColor, targetColor, 1);

    expect(next).toEqual(targetColor);
  });

  it('should calculate a color value', () => {
    const next = calculateNextCssValue(currentColor, targetColor, 0.75);

    expect(next).toEqual({
      type: 'color',
      value: ['rgb', 191, 191, 191],
    });
  });
});
