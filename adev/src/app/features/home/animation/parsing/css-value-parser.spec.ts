/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {cssValueParser} from './css-value-parser';

describe('css-value-parser', () => {
  it('should parse a simple static value', () => {
    const value = cssValueParser('block');

    expect(value).toEqual({
      type: 'static',
      value: 'block',
    });
  });

  it('should parse a color value', () => {
    const value = cssValueParser('#ff0000');

    expect(value).toEqual({
      type: 'color',
      value: '#ff0000',
    });
  });

  it('should parse a single numeric integer value', () => {
    const value = cssValueParser('42px');

    expect(value).toEqual({
      type: 'numeric',
      values: [[42, 'px']],
    });
  });

  it('should parse a single numberic decimal value', () => {
    const value = cssValueParser('66.6%');

    expect(value).toEqual({
      type: 'numeric',
      values: [[66.6, '%']],
    });
  });

  it('should parse a single unitless numberic value', () => {
    const value = cssValueParser('1337');

    expect(value).toEqual({
      type: 'numeric',
      values: [[1337, '']],
    });
  });

  it('should parse a list of numeric values', () => {
    const value = cssValueParser('42px 13.37rem 0%');

    expect(value).toEqual({
      type: 'numeric',
      values: [
        [42, 'px'],
        [13.37, 'rem'],
        [0, '%'],
      ],
    });
  });

  it('should parse a simple transform value', () => {
    const value = cssValueParser('translateX(42%)');

    expect(value).toEqual({
      type: 'transform',
      values: new Map([['translateX', [[42, '%']]]]),
    });
  });

  it('should parse a transform value with a single function with multiple parameters', () => {
    const value = cssValueParser('translate(42%, 0px)');

    expect(value).toEqual({
      type: 'transform',
      values: new Map([
        [
          'translate',
          [
            [42, '%'],
            [0, 'px'],
          ],
        ],
      ]),
    });
  });

  it('should parse a transform value with a single function with a single unitless parameter', () => {
    const value = cssValueParser('scale(1.5)');

    expect(value).toEqual({
      type: 'transform',
      values: new Map([['scale', [[1.5, '']]]]),
    });
  });

  it('should parse a transform value with a single function with multiple unitless parameter', () => {
    const value = cssValueParser('scale(1.5, 42)');

    expect(value).toEqual({
      type: 'transform',
      values: new Map([
        [
          'scale',
          [
            [1.5, ''],
            [42, ''],
          ],
        ],
      ]),
    });
  });

  it('should parse a transform value with multiple functions with multiple parameters', () => {
    const value = cssValueParser('translate(42%, 0px) scale(1.5) rotate(180deg)');

    expect(value).toEqual({
      type: 'transform',
      values: new Map([
        [
          'translate',
          [
            [42, '%'],
            [0, 'px'],
          ],
        ],
        ['scale', [[1.5, '']]],
        ['rotate', [[180, 'deg']]],
      ]),
    });
  });

  it('should parse an unsupported transform value as a static one', () => {
    const value = cssValueParser('matrix(1, 2, 3)');

    expect(value).toEqual({
      type: 'static',
      value: 'matrix(1, 2, 3)',
    });
  });

  it('should parse a transform value which function have both unit and unitless values as static', () => {
    const value = cssValueParser('translate(42, 1337px)');

    expect(value).toEqual({
      type: 'static',
      value: 'translate(42, 1337px)',
    });
  });

  it('should parse a transform value with a function without parameters as a static one', () => {
    const value = cssValueParser('translate()');

    expect(value).toEqual({
      type: 'static',
      value: 'translate',
    });
  });
});
