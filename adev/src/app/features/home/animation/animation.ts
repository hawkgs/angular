/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {inject, Renderer2} from '@angular/core';
import {AnimationLayerDirective} from './animation-layer.directive';
import {
  AnimationConfig,
  AnimationDefinition,
  AnimationRule,
  DynamicAnimationRule,
  ParsedStyles,
  Styles,
} from './types';
import {CssPropertyValue, cssValueParser, stringifyParsedValue} from './parsing';
import {calculateNextCssValue} from './calculations';

// The string seperator between a layed ID and an object selector.
const SEL_SEPARATOR = '>>';

const DEFAULT_CONFIG: AnimationConfig = {
  /** How much the time increments or decrements when you go forward or backward. In the
   *  case of an auto play, the timestep virtually acts as FPS (frames per second). */
  timestep: 0.1,
};

const getStartTime = (r: AnimationRule<Styles | ParsedStyles>): number =>
  r.timespan ? r.timespan[0] : r.at;

const getEndTime = (r: AnimationRule<Styles | ParsedStyles>): number =>
  r.timespan ? r.timespan[1] : r.at;

const getEndStyles = (r: AnimationRule<ParsedStyles>): ParsedStyles =>
  r.timespan ? r.to : r.styles;

// Animation player
export class Animation {
  private readonly renderer = inject(Renderer2);

  private config: AnimationConfig;
  private rules: AnimationRule<ParsedStyles>[] = [];
  private currentTime: number = 0;
  private allObjects = new Map<string, HTMLElement>(); // selector; HTML element
  private activeStyles = new Map<string, ParsedStyles>(); // selector; ParsedStyles
  private animationFrameId: number = 0;

  constructor(layers: AnimationLayerDirective[], config?: Partial<AnimationConfig>) {
    // Merge the config with the default one, if incomplete.
    this.config = {...DEFAULT_CONFIG, ...(config || {})};

    // Set layer elements in the objects map.
    this.allObjects = new Map(layers.map((f) => [f.id(), f.elementRef.nativeElement]));
  }

  define(definition: AnimationDefinition) {
    this.validateAndExtractObjectsFromLayers(definition);

    // Parse the rules
    this.rules = definition
      .sort((a, b) => getStartTime(a) - getStartTime(b))
      .map((rule) => {
        if (rule.timespan) {
          const from: ParsedStyles = {};
          const to: ParsedStyles = {};
          for (const [prop, val] of Object.entries(rule.from)) {
            from[prop] = cssValueParser(val);
          }
          for (const [prop, val] of Object.entries(rule.to)) {
            to[prop] = cssValueParser(val);
          }
          return {...rule, from, to};
        } else {
          const styles: ParsedStyles = {};
          for (const [prop, val] of Object.entries(rule.styles)) {
            styles[prop] = cssValueParser(val);
          }
          return {...rule, styles};
        }
      });
  }

  play() {
    if (!this.rules.length) {
      console.warn("Animation: Can't play without a definition");
      return;
    }

    this.animate(Date.now(), 0);
  }

  pause() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  forward(timestep?: number) {
    if (!this.rules.length) {
      console.warn("Animation: Can't go forward without a definition");
      return;
    }
    timestep = timestep ?? this.config.timestep;

    const time = this.currentTime + timestep;
    this.updateFrame(time);
  }

  back(timestep?: number) {
    if (!this.rules.length) {
      console.warn("Animation: Can't go back without a definition");
      return;
    }
    timestep = timestep ?? this.config.timestep;

    const time = this.currentTime - timestep;

    if (time >= 0) {
      this.updateFrame(time);
    }
  }

  reset() {
    this.pause();
    this.currentTime = 0;

    for (const [selector, styles] of Array.from(this.activeStyles)) {
      for (const [style] of Object.entries(styles)) {
        const element = this.allObjects.get(selector);
        this.renderer.removeStyle(element, style);
      }
      this.activeStyles.delete(selector);
    }
  }

  private updateFrame(time: number) {
    const completedRules = this.rules.filter((r) => time > getEndTime(r));
    const inProgressDynamicRules = this.rules.filter((r) => {
      const start = getStartTime(r);
      const end = getEndTime(r);
      // We exclude the static animation rules by `start < end` since `start == end`.
      return start < end && start <= time && time <= end;
    }) as DynamicAnimationRule<ParsedStyles>[];

    const stylesState = new Map<string, ParsedStyles>(); // All styles state relative to `time`

    // Extract the completed rules directly
    for (const rule of completedRules) {
      let objectStyles = stylesState.get(rule.selector) || {};
      objectStyles = {...objectStyles, ...getEndStyles(rule)};
      stylesState.set(rule.selector, objectStyles);
    }

    // Active rules
    for (const rule of inProgressDynamicRules) {
      const deltaTime = time - this.currentTime;
      let timespan: number;
      let targetStyles: ParsedStyles;

      if (deltaTime > 0) {
        timespan = getEndTime(rule) - this.currentTime;
        targetStyles = rule.to;
      } else {
        timespan = this.currentTime - getStartTime(rule);
        targetStyles = rule.from;
      }

      const changeRate = Math.abs(deltaTime / timespan);

      const activeStyles = this.activeStyles.get(rule.selector)!;
      const styles = stylesState.get(rule.selector) || {};

      for (const [prop, value] of Object.entries(targetStyles)) {
        const target = value;
        const curr = activeStyles[prop];
        const next = calculateNextCssValue(target, curr, changeRate);

        styles[prop] = next;
      }

      stylesState.set(rule.selector, styles);
    }

    // Apply rule styles
    for (const [selector, styles] of Array.from(stylesState)) {
      for (const [prop, value] of Object.entries(styles)) {
        this.setStyle(selector, prop, value);
      }
    }

    this.currentTime = time;
  }

  private setStyle(selector: string, property: string, value: CssPropertyValue) {
    const element = this.allObjects.get(selector);
    this.renderer.setStyle(element, property, stringifyParsedValue(value));

    const activeStyles = this.activeStyles.get(selector) || {};
    activeStyles[property] = value;
    this.activeStyles.set(selector, activeStyles);
  }

  private animate(then: number, elapsed: number) {
    this.animationFrameId = requestAnimationFrame(() => this.animate(then, elapsed));

    const now = Date.now();
    elapsed = now - then;

    if (elapsed >= this.config.timestep) {
      then = now - (elapsed % this.config.timestep);

      this.updateFrame(this.currentTime + elapsed);
    }
  }

  private validateAndExtractObjectsFromLayers(definition: AnimationDefinition) {
    for (const rule of definition) {
      this.validateStyles(rule);
      this.validateAndExtractObjects(rule);
    }
  }

  private validateStyles(rule: AnimationRule<Styles>) {
    if (!rule.timespan) {
      return;
    }

    const fromStyles = Object.entries(rule.from);
    const toStyles = Object.entries(rule.to);

    if (fromStyles.length !== toStyles.length) {
      throw new Error(
        `Animation: There is a mismatch between the number of "from" and "to" styles for selector ${rule.selector}`,
      );
    }
    for (const [prop] of toStyles) {
      if (!rule.from[prop]) {
        throw new Error(`Animation: "from" style ${prop} is missing for selector ${rule.selector}`);
      }
    }
  }

  /**
   * Extracts all objects (layer elements and layer child elements) by their provided selectors.
   */
  private validateAndExtractObjects(rule: AnimationRule<Styles>) {
    let [layerId, objectSelector] = rule.selector.split(SEL_SEPARATOR);
    layerId = layerId.trim();
    objectSelector = (objectSelector ?? '').trim();

    const layer = this.allObjects.get(layerId);
    if (!layer) {
      throw new Error(`Animation: Missing layer ID: ${layerId}`);
    }

    if (objectSelector && !this.allObjects.has(rule.selector)) {
      const object = layer.querySelector(objectSelector);
      if (!object) {
        throw new Error(`Animation: Missing layer object ${object}`);
      }

      if (!this.allObjects.has(rule.selector)) {
        this.allObjects.set(rule.selector, object as HTMLElement);
      }
    }
  }
}
