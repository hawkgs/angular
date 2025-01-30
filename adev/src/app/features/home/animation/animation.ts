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
import {CssPropertyValue, cssValueParser, stringifyParsedValue} from './parsing';
import {calculateNextCssValue} from './calculations';
import {stylesUnion} from './utils';
import {AnimationPlugin} from './plugins/types';

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
  private _renderer: Renderer2;

  /** Parsed rules. Time is in milliseconds. */
  private _rules: AnimationRule<ParsedStyles>[] = [];
  private _config: AnimationConfig;
  private _currentTime: number = 0;
  private _duration: number = 0;
  private _allObjects = new Map<string, Element | Element[]>(); // selector; element(s)
  private _activeStyles = new Map<string, ParsedStyles>(); // selector; ParsedStyles
  private _animationFrameId: number | null = null;
  private _completed: boolean = false;
  private _isPlaying = signal<boolean>(false);
  private _progress = signal<number>(0);
  private _plugins: AnimationPlugin[] = [];

  /** Returns whether the animation is playing or not */
  isPlaying = this._isPlaying.asReadonly();

  /** Returns the animation progress (`[0,1]`) */
  progress = this._progress.asReadonly();

  constructor(
    layers: readonly AnimationLayerDirective[],
    injector: Injector,
    config?: Partial<AnimationConfig>,
  ) {
    this._renderer = injector.get(RendererFactory2).createRenderer(null, null);

    // Merge the config with the default one, if incomplete.
    this._config = {...DEFAULT_CONFIG, ...(config || {})};

    // Set layer elements in the objects map.
    this._allObjects = new Map(layers.map((f) => [f.id(), f.elementRef.nativeElement]));
  }

  /** Animation duration. In milliseconds */
  get duration() {
    return this._duration;
  }

  /** Animation timestep (config). In milliseconds */
  get timestep() {
    return this._config.timestep;
  }

  /**
   * Define the animation.
   *
   * @param definition Definition (i.e. `AnimationRule` array)
   * @returns The animation
   */
  define(definition: AnimationDefinition) {
    this._extractObjectsAndValidateRules(definition);

    // Parse the rules.
    // IMPORTANT: Parsed rules use milliseconds instead of seconds.
    this._rules = definition
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
    this._duration = Math.max(...this._rules.map((r) => getEndTime(r)));

    return this;
  }

  /** Play the animation. */
  play() {
    if (this._animationFrameId !== null) {
      return;
    }
    if (!this._rules.length) {
      console.warn("Animation: Can't play without a definition");
      return;
    }
    // If the animation is completed, reset it on play.
    if (this._completed) {
      this.reset();
      this._completed = false;
    }

    this._isPlaying.set(true);

    // Start the animation.
    this._animate(Date.now(), 0);
  }

  /** Pause the animation. */
  pause() {
    if (this._animationFrameId !== null) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = null;
      this._isPlaying.set(false);
    }
  }

  /**
   * Fast-forward or go back at a specific time.
   *
   * @param progress Time (in percent) at which the player should render the animation
   * @returns
   */
  seek(progress: number) {
    this.pause();

    if (!this._rules.length) {
      console.warn("Animation: Can't  without a definition");
      return;
    }

    progress = Math.max(0, Math.min(progress, 1));
    const time = Math.round(progress * this._duration);

    this._updateFrame(time);
    this._completed = progress === 1;
  }

  /**
   * Go forward in time.
   *
   * @param timestep Custom timestep different from the config one
   * @returns
   */
  forward(timestep?: number) {
    this.pause();

    if (!this._rules.length) {
      console.warn("Animation: Can't go forward without a definition");
      return;
    }
    timestep = timestep ?? this._config.timestep;

    const time = this._currentTime + timestep;

    if (time <= this._duration) {
      this._updateFrame(time);
    } else {
      this._completed = true;
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

    if (!this._rules.length) {
      console.warn("Animation: Can't go back without a definition");
      return;
    }
    timestep = timestep ?? this._config.timestep;

    const time = this._currentTime - timestep;

    if (time >= 0) {
      this._updateFrame(time);

      // Uncomplete the animation, if it was completed.
      this._completed = false;
    }
  }

  /** Reset the animation. */
  reset() {
    this.pause();
    this._currentTime = 0;
    this._progress.set(0);

    for (const [selector, styles] of Array.from(this._activeStyles)) {
      for (const [style] of Object.entries(styles)) {
        const element = this._allObjects.get(selector);
        this._renderer.removeStyle(element, style);
      }
      this._activeStyles.delete(selector);
    }
  }

  /** Alias for `reset`. */
  stop() {
    this.reset();
  }

  /**
   * Add and initialize `AnimationPlugin` to the animation.
   *
   * @param plugin Plugin to be added
   * @returns The animation
   */
  addPlugin(plugin: AnimationPlugin) {
    plugin.init(this);
    this._plugins.push(plugin);

    return this;
  }

  /**
   * Cleans all of the resources that might cause memory leaks (e.g. plugins).
   * Resets the animation and cleans the definition.
   */
  dispose() {
    for (const plugin of this._plugins) {
      plugin.destroy();
    }
    this.reset();
    this._rules = [];
    this._duration = 0;
    this._plugins = [];
  }

  /**
   * Update the frame/animation by a given time.
   *
   * @param time Time at which the animation should be rendered.
   */
  private _updateFrame(time: number) {
    const completedRules = this._rules.filter((r) => time > getEndTime(r));
    const inProgressDynamicRules = this._rules.filter((r) => {
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

    const deltaTime = time - this._currentTime;

    // ... and then calculate the change of the dynamic rules in progress.
    for (const rule of inProgressDynamicRules) {
      let timespan: number;
      let targetStyles: ParsedStyles;
      let relativeDeltaT: number;

      // Determine the change direction. Negative Dt means going back in time; postive – forward.
      //
      // It's important to calculate the relative time since the global current time might go out of
      // rule boundaries which will scew the final change rate calculations.
      //
      // For example:
      // If the currentTime = 0; time = 2; for a rule active between [1, 5];
      // the Dt = 2, but only one second has passed from the rule's timespan,
      // i.e. we have to use a relative time which in this case is equal to timespan[0].
      // relativeDt = 1 (not 2); timespan = 4 (not 5); changeRate = 0.25 (not 0.4)
      if (deltaTime > 0) {
        const relativeTime = Math.max(this._currentTime, rule.timespan[0]);
        relativeDeltaT = time - relativeTime;
        timespan = getEndTime(rule) - relativeTime;
        targetStyles = rule.to;
      } else {
        const relativeTime = Math.min(this._currentTime, rule.timespan[1]);
        relativeDeltaT = time - relativeTime;
        timespan = relativeTime - getStartTime(rule);
        targetStyles = rule.from;
      }

      const changeRate = Math.abs(relativeDeltaT / timespan);

      const activeStyles = stylesUnion(rule.from, this._activeStyles.get(rule.selector) || {});
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
    for (const [selector, styles] of Array.from(this._activeStyles)) {
      const newStyles = stylesState.get(selector);
      for (const prop of Object.keys(styles)) {
        if (!newStyles || !newStyles[prop]) {
          this._removeStyle(selector, prop);
        }
      }
    }

    // Apply the rule styles.
    for (const [selector, styles] of Array.from(stylesState)) {
      for (const [prop, value] of Object.entries(styles)) {
        this._setStyle(selector, prop, value);
      }
    }

    this._currentTime = time;
    this._progress.set(time / this.duration);
  }

  /** Set active style. */
  private _setStyle(selector: string, property: string, value: CssPropertyValue) {
    const elements = this._allObjects.get(selector)!;

    const valueString = stringifyParsedValue(value);

    if (elements instanceof Element) {
      this._renderer.setStyle(elements, property, valueString);
    } else {
      for (const e of elements) {
        this._renderer.setStyle(e, property, valueString);
      }
    }

    const activeStyles = this._activeStyles.get(selector) || {};
    activeStyles[property] = value;
    this._activeStyles.set(selector, activeStyles);
  }

  /** Remove active style. */
  private _removeStyle(selector: string, property: string) {
    const elements = this._allObjects.get(selector)!;

    if (elements instanceof Element) {
      this._renderer.removeStyle(elements, property);
    } else {
      for (const e of elements) {
        this._renderer.removeStyle(e, property);
      }
    }

    const activeStyles = this._activeStyles.get(selector) || {};
    delete activeStyles[property];
  }

  /** Animate function. */
  private _animate(then: number, elapsed: number) {
    this._animationFrameId = requestAnimationFrame(() => this._animate(then, elapsed));

    const now = Date.now();
    elapsed = now - then;

    if (elapsed >= this._config.timestep) {
      // Subtract the overflowed time from Now to maintain steady fps.
      then = now - (elapsed % this._config.timestep);

      const time = this._currentTime + elapsed;

      if (time <= this._duration) {
        this._updateFrame(time);
      } else {
        // Pause the animation and mark it as completed
        // when we go over the duration.
        this.pause();
        this._completed = true;
      }
    }
  }

  /** Extract the objects from the selectors and validate their rules.  */
  private _extractObjectsAndValidateRules(definition: AnimationDefinition) {
    for (const rule of definition) {
      this._validateRules(rule);
      this._extractObjects(rule);
    }
  }

  /** Check whether the start and end styles match and the timespan is correct. */
  private _validateRules(rule: AnimationRule<Styles>) {
    if (!rule.timespan) {
      return;
    }

    const duration = rule.timespan[1] - rule.timespan[0];
    if (duration < 0) {
      throw new Error(
        `Animation: Incorrect timespan for selector '${rule.selector}'. Start time is greater than end time`,
      );
    } else if (duration === 0) {
      throw new Error(
        `Animation: Duration for selector '${rule.selector}' is zero. Use 'at' time selector instead`,
      );
    }

    const fromStyles = Object.keys(rule.from);
    const toStyles = Object.keys(rule.to);

    if (fromStyles.length !== toStyles.length) {
      throw new Error(
        `Animation: There is a mismatch between the number of "from" and "to" styles for selector '${rule.selector}'`,
      );
    }
    for (const prop of toStyles) {
      if (!rule.from[prop]) {
        throw new Error(
          `Animation: "from" style '${prop}' is missing for selector '${rule.selector}'`,
        );
      }
    }
  }

  /**
   * Extracts all objects (layer elements and layer child elements) by their provided selectors.
   */
  private _extractObjects(rule: AnimationRule<Styles>) {
    let [layerId, objectSelector] = rule.selector.split(SEL_SEPARATOR);
    layerId = layerId.trim();
    objectSelector = (objectSelector ?? '').trim();

    const layer = this._allObjects.get(layerId) as Element;
    if (!layer) {
      throw new Error(`Animation: Missing layer ID: ${layerId}`);
    }

    if (objectSelector && !this._allObjects.has(rule.selector)) {
      const objects = layer.getElementsByClassName(objectSelector.replaceAll('.', ' ').trim());
      if (!objects.length) {
        throw new Error(`Animation: Missing layer object(s): ${rule.selector}`);
      }

      if (!this._allObjects.has(rule.selector)) {
        this._allObjects.set(
          rule.selector,
          objects.length === 1 ? objects[0] : Array.from(objects),
        );
      }
    }
  }
}
