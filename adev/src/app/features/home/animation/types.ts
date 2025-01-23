/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {CssPropertyValue} from './parsing';

export type AnimationConfig = {
  timestep: number;
};

// Todo(Georgi): It will be better to parse all string value to the internal model
// initially, instead of doing that during every frame update.
export type Styles = {[key: string]: string};

export type ParsedStyles = {[key: string]: CssPropertyValue};

interface AnimationRuleBase {
  /** Selector in the form of `LAYER_ID >> OBJECT_SELECTOR`. The object selector is optional */
  selector: string;
}

/** Animation definition */
export interface DynamicAnimationRule<T extends Styles | ParsedStyles> extends AnimationRuleBase {
  at?: never;

  timespan: [number, number];
  from: T;
  to: T;
}

export interface StaticAnimationRule<T extends Styles | ParsedStyles> extends AnimationRuleBase {
  timespan?: never;

  at: number;
  styles: T;
}

export type AnimationRule<T extends Styles | ParsedStyles> =
  | DynamicAnimationRule<T>
  | StaticAnimationRule<T>;

export type AnimationDefinition = AnimationRule<Styles>[];
