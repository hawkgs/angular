/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

export type NumericValue = {
  type: 'numeric';
  values: [number, string][];
};

export type StaticValue = {
  type: 'static';
  value: string;
};

export type ColorValue = {
  type: 'color';
  value: string;
};

export type TransformValue = {
  type: 'tranform';
  values: Map<string, NumericValue>; // function name, NumericValue
};

/** A parsed CSS property value. */
export type CssPropertyValue = NumericValue | StaticValue | ColorValue | TransformValue;
