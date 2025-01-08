/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {inject, Renderer2} from '@angular/core';
import {WINDOW} from '@angular/docs';
import {AnimationLayerDirective} from './animation-layer.directive';
import {AnimationConfig, AnimationRule, Styles} from './types';

// The string seperator between a layed ID and an object selector.
const SEL_SEPARATOR = '>>';

const DEFAULT_CONFIG: AnimationConfig = {
  timestep: 0.1,
};

export class Animation {
  private readonly renderer = inject(Renderer2);
  private readonly window = inject(WINDOW);

  private config: AnimationConfig;
  private rules: AnimationRule[] = [];
  private currentTime: number = 0;
  private allObjects = new Map<string, HTMLElement>(); // selector; HTML element
  private activeStyles = new Map<string, Styles>(); // selector; Styles
  private initialStyles = new Map<string, Styles>(); // selector; Styles

  constructor(layers: AnimationLayerDirective[], config?: Partial<AnimationConfig>) {
    this.config = {...DEFAULT_CONFIG, ...(config || {})};
    this.allObjects = new Map(layers.map((f) => [f.id(), f.elementRef.nativeElement]));
  }

  setRules(rules: AnimationRule[]) {
    this.rules = rules.sort((a, b) => a.to - b.to);
    this.validateAndExtractObjectsFromLayers();
    this.createInitialStylesSnapshot();
  }

  play() {
    if (!this.rules.length) {
      console.warn("Animation: Can't play without provided rules");
      return;
    }

    // tbd
  }

  pause() {
    // tbd
  }

  forward(timestep?: number) {
    if (!this.rules.length) {
      console.warn("Animation: Can't go forward without provided rules");
      return;
    }
    timestep = timestep ?? this.config.timestep;

    // tbd
  }

  back(timestep?: number) {
    if (!this.rules.length) {
      console.warn("Animation: Can't go back without provided rules");
      return;
    }
    timestep = timestep ?? this.config.timestep;

    // tbd
  }

  reset() {
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
    const completedRules = this.rules.filter((r) => time > r.to);
    const activeRules = this.rules.filter((r) => r.from <= time && time <= r.to);

    const stylesState = new Map<string, Styles>(); // All styles state relative to `time`

    // Extract the completed rules directly
    for (const rule of completedRules) {
      let objectStyles = stylesState.get(rule.selector) || {};
      objectStyles = {...objectStyles, ...rule.styles};
      stylesState.set(rule.selector, objectStyles);
    }

    // Active rules
    for (const rule of activeRules) {
      const delta = time - this.currentTime;
      const activeStyles = this.activeStyles.get(rule.selector)!;
      const styles = stylesState.get(rule.selector) || {};

      for (const [prop, value] of Object.entries(rule.styles)) {
        // Todo(Georgi): This is the algorithm for simple numeric values; WIP
        //
        // const newValue = activeStyles[prop] - value;
        // const deltaPerTimeunit = newValue / delta;
        // const valueDelta = deltaPerTimeunit * this.config.timestep;
        //
        // styles[prop] = activeStyles[prop] + valueDelta;
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

  private setStyle(selector: string, property: string, value: string) {
    const element = this.allObjects.get(selector);
    this.renderer.setStyle(element, property, value);

    const activeStyles = this.activeStyles.get(selector) || {};
    activeStyles[property] = value;
    this.activeStyles.set(selector, activeStyles);
  }

  /**
   * Extracts all objects (layer elements and layer child elements) by their provided selectors.
   */
  private validateAndExtractObjectsFromLayers() {
    for (const rule of this.rules) {
      let [layerId, objectSelector] = rule.selector.split(SEL_SEPARATOR);
      layerId = layerId.trim();
      objectSelector = (objectSelector ?? '').trim();

      const layer = this.allObjects.get(layerId);
      if (!layer) {
        throw new Error(`Animation: Missing layer ID: ${layerId}`);
      }

      if (objectSelector) {
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

  /**
   * Creates a snapshot of the initial/computed styles of all objects
   */
  private createInitialStylesSnapshot() {
    // Contains a set will all applied rule styles for each object
    const styleGroups = new Map<string, Set<string>>(); // selector; style properties

    // Create the groups
    for (const rule of this.rules) {
      let group = styleGroups.get(rule.selector);
      if (!group) {
        group = new Set();
      }

      for (const [prop] of Object.entries(rule.styles)) {
        group.add(prop);
      }
      styleGroups.set(rule.selector, group);
    }

    // Save initial styles for each object
    for (const [selector, element] of Array.from(this.allObjects)) {
      const computed = this.window.getComputedStyle(element);
      const styles: Styles = {};

      const group = styleGroups.get(selector)!;
      for (const prop of Array.from(group)) {
        styles[prop] = computed.getPropertyValue(prop);
      }

      this.initialStyles.set(selector, styles);
    }
  }
}
