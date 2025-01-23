/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {Injector, Renderer2, RendererFactory2, signal} from '@angular/core';
import {AnimationLayerDirective} from './animation-layer.directive';
import {
  AnimationConfig,
  AnimationDefinition,
  AnimationRule,
  DynamicAnimationRule,
  ParsedStyles,
  Styles,
} from './types';
import {CssPropertyValue, cssValueParser, stringifyParsedValue, TransformValue} from './parsing';
import {calculateNextCssValue} from './calculations';

// The string seperator between a layed ID and an object selector.
const SEL_SEPARATOR = '>>';

// One millisecond.
const MS = 1000;

// Default config.
const DEFAULT_CONFIG: AnimationConfig = {
  timestep: 100,
};

const getStartTime = (r: AnimationRule<Styles | ParsedStyles>): number =>
  r.timespan ? r.timespan[0] : r.at;

const getEndTime = (r: AnimationRule<Styles | ParsedStyles>): number =>
  r.timespan ? r.timespan[1] : r.at;

const getEndStyles = (r: AnimationRule<ParsedStyles>): ParsedStyles =>
  r.timespan ? r.to : r.styles;

/**
 * CSS animation player.
 */
export class Animation {
  private renderer: Renderer2;

  /** Parsed rules. Time is in milliseconds. */
  private rules: AnimationRule<ParsedStyles>[] = [];
  private config: AnimationConfig;
  private currentTime: number = 0;
  private _duration: number = 0;
  private allObjects = new Map<string, HTMLElement>(); // selector; HTML element
  private activeStyles = new Map<string, ParsedStyles>(); // selector; ParsedStyles
  private animationFrameId: number | null = null;
  private completed: boolean = false;
  private _isPlaying = signal<boolean>(false);

  isPlaying = this._isPlaying.asReadonly();

  constructor(
    layers: readonly AnimationLayerDirective[],
    injector: Injector,
    config?: Partial<AnimationConfig>,
  ) {
    this.renderer = injector.get(RendererFactory2).createRenderer(null, null);

    // Merge the config with the default one, if incomplete.
    this.config = {...DEFAULT_CONFIG, ...(config || {})};

    // Set layer elements in the objects map.
    this.allObjects = new Map(layers.map((f) => [f.id(), f.elementRef.nativeElement]));
  }

  /** Animation duration. */
  get duration() {
    return this._duration;
  }

  define(definition: AnimationDefinition) {
    this.extractObjectsAndValidateStyles(definition);

    // Parse the rules.
    // IMPORTANT: Parsed rules use milliseconds instead of seconds.
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
          // Convert to milliseconds.
          const msTimespan = rule.timespan.map((t) => t * MS) as [number, number];

          return {...rule, from, to, timespan: msTimespan};
        } else {
          const styles: ParsedStyles = {};

          for (const [prop, val] of Object.entries(rule.styles)) {
            styles[prop] = cssValueParser(val);
          }
          // Convert to milliseconds.
          const msAt = rule.at * MS;

          return {...rule, styles, at: msAt};
        }
      });

    // Calculate the duration of the animation.
    // IMPORTANT: Use parsed rules with milliseconds.
    this._duration = Math.max(...this.rules.map((r) => getEndTime(r)));

    return this;
  }

  /** Play the animation. */
  play() {
    if (this.animationFrameId !== null) {
      return;
    }
    if (!this.rules.length) {
      console.warn("Animation: Can't play without a definition");
      return;
    }
    // If the animation is completed, reset it on play.
    if (this.completed) {
      this.reset();
      this.completed = false;
    }

    this._isPlaying.set(true);

    // Start the animation.
    this.animate(Date.now(), 0);
  }

  /** Pause the animation. */
  pause() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
      this._isPlaying.set(false);
    }
  }

  /**
   * Go forward in time.
   *
   * @param timestep Custom timestep different from the config one
   * @returns
   */
  forward(timestep?: number) {
    this.pause();

    if (!this.rules.length) {
      console.warn("Animation: Can't go forward without a definition");
      return;
    }
    timestep = timestep ?? this.config.timestep;

    const time = this.currentTime + timestep;

    if (time <= this._duration) {
      this.updateFrame(time);
    } else {
      this.completed = true;
    }
  }

  /**
   * Go back in time.
   *
   * @param timestep Custom timestep different from the config one
   * @returns
   */
  back(timestep?: number) {
    this.pause();

    if (!this.rules.length) {
      console.warn("Animation: Can't go back without a definition");
      return;
    }
    timestep = timestep ?? this.config.timestep;

    const time = this.currentTime - timestep;

    if (time >= 0) {
      this.updateFrame(time);

      // Uncomplete the animation, if it was completed.
      this.completed = false;
    }
  }

  /** Reset the animation. */
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

  /** Alias for `reset`. */
  stop() {
    this.reset();
  }

  /**
   * Update the frame/animation by a given time.
   *
   * @param time Time at which the animation should be rendered.
   */
  private updateFrame(time: number) {
    const completedRules = this.rules.filter((r) => time > getEndTime(r));
    const inProgressDynamicRules = this.rules.filter((r) => {
      const start = getStartTime(r);
      const end = getEndTime(r);
      // We exclude the static animation rules by `start < end` since `start == end`.
      return start < end && start <= time && time <= end;
    }) as DynamicAnimationRule<ParsedStyles>[];

    // All styles/styles state relative to `time`.
    const stylesState = new Map<string, ParsedStyles>();

    // Extract the completed rules (their styles) directly ...
    for (const rule of completedRules) {
      let objectStyles = stylesState.get(rule.selector) || {};
      objectStyles = {...objectStyles, ...getEndStyles(rule)};
      stylesState.set(rule.selector, objectStyles);
    }

    // ... and then calculate the change of the dynamic rules in progress.
    for (const rule of inProgressDynamicRules) {
      const deltaTime = time - this.currentTime;
      let timespan: number;
      let targetStyles: ParsedStyles;

      // Determine the change direction. Negative Dt means going back in time.
      if (deltaTime > 0) {
        timespan = getEndTime(rule) - this.currentTime;
        targetStyles = rule.to;
      } else {
        timespan = this.currentTime - getStartTime(rule);
        targetStyles = rule.from;
      }

      const changeRate = Math.abs(deltaTime / timespan);

      // Make sure that any active styles should overwrite the start styles.
      const activeStyles: ParsedStyles = {...rule.from, ...this.activeStyles.get(rule.selector)};
      const styles = stylesState.get(rule.selector) || {};

      for (const [prop, value] of Object.entries(targetStyles)) {
        const target = value;
        const curr = activeStyles[prop];
        const next = calculateNextCssValue(curr, target, changeRate);

        styles[prop] = next;
      }

      stylesState.set(rule.selector, styles);
    }

    // Get rid of any active styles that are not part from the current styles state
    for (const [selector, styles] of Array.from(this.activeStyles)) {
      const newStyles = stylesState.get(selector);
      for (const prop of Object.keys(styles)) {
        if (!newStyles || !newStyles[prop]) {
          this.removeStyle(selector, prop);
        }
      }
    }

    // Apply the rule styles.
    for (const [selector, styles] of Array.from(stylesState)) {
      for (const [prop, value] of Object.entries(styles)) {
        this.setStyle(selector, prop, value);
      }
    }

    this.currentTime = time;
  }

  /** Set active style. */
  private setStyle(selector: string, property: string, value: CssPropertyValue) {
    const element = this.allObjects.get(selector);
    this.renderer.setStyle(element, property, stringifyParsedValue(value));

    const activeStyles = this.activeStyles.get(selector) || {};
    activeStyles[property] = value;
    this.activeStyles.set(selector, activeStyles);
  }

  /** Remove active style. */
  private removeStyle(selector: string, property: string) {
    const element = this.allObjects.get(selector);
    this.renderer.removeStyle(element, property);

    const activeStyles = this.activeStyles.get(selector) || {};
    delete activeStyles[property];
  }

  /** Animate function. */
  private animate(then: number, elapsed: number) {
    this.animationFrameId = requestAnimationFrame(() => this.animate(then, elapsed));

    const now = Date.now();
    elapsed = now - then;

    if (elapsed >= this.config.timestep) {
      // Subtract the overflowed time from Now to maintain steady fps.
      then = now - (elapsed % this.config.timestep);

      const time = this.currentTime + elapsed;

      if (time <= this._duration) {
        this.updateFrame(time);
      } else {
        // Pause the animation and mark it as completed
        // when we go over the duration.
        this.pause();
        this.completed = true;
      }
    }
  }

  /** Extract the objects from the selectors and validate their styles.  */
  private extractObjectsAndValidateStyles(definition: AnimationDefinition) {
    for (const rule of definition) {
      this.validateStyles(rule);
      this.extractObjects(rule);
    }
  }

  /** Check whether the start and end styles match. */
  private validateStyles(rule: AnimationRule<Styles>) {
    if (!rule.timespan) {
      return;
    }

    const fromStyles = Object.keys(rule.from);
    const toStyles = Object.keys(rule.to);

    if (fromStyles.length !== toStyles.length) {
      throw new Error(
        `Animation: There is a mismatch between the number of "from" and "to" styles for selector ${rule.selector}`,
      );
    }
    for (const prop of toStyles) {
      if (!rule.from[prop]) {
        throw new Error(`Animation: "from" style ${prop} is missing for selector ${rule.selector}`);
      }
    }
  }

  /**
   * Extracts all objects (layer elements and layer child elements) by their provided selectors.
   */
  private extractObjects(rule: AnimationRule<Styles>) {
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
        throw new Error(`Animation: Missing layer object: ${objectSelector}`);
      }

      if (!this.allObjects.has(rule.selector)) {
        this.allObjects.set(rule.selector, object as HTMLElement);
      }
    }
  }
}
