/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {effect, inject, Injectable, RendererFactory2} from '@angular/core';
import {DOCUMENT} from '@angular/common';
import {WINDOW} from '../application-providers/window_provider';
import {Settings} from './settings';
import {Theme} from './theme_types';

// Keep class names in sync with _theme.scss and _global.scss
const THEME_CLASS_SUFFIX = 'theme';
const DARK_THEME_CLASS = `dark-${THEME_CLASS_SUFFIX}`;
const LIGHT_THEME_CLASS = `light-${THEME_CLASS_SUFFIX}`;

@Injectable({providedIn: 'root'})
export class ThemeService {
  private readonly win = inject(WINDOW);
  private readonly doc = inject(DOCUMENT);
  private readonly settings = inject(Settings);
  private readonly rendererFactory = inject(RendererFactory2);
  private readonly renderer = this.rendererFactory.createRenderer(null, null);
  readonly currentTheme = this.settings.currentTheme;

  constructor() {
    effect(() => {
      this.changeThemeClass(this.currentTheme());
    });
  }

  get prefersDarkMode(): boolean {
    return this.win.matchMedia && this.win.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  toggleDarkMode(isDark: boolean): void {
    this.currentTheme.set(isDark ? 'dark-theme' : 'light-theme');
  }

  private changeThemeClass(theme: Theme) {
    const el = this.doc.documentElement;

    for (const themeClass of el.classList) {
      if (themeClass.endsWith(THEME_CLASS_SUFFIX)) {
        this.renderer.removeClass(el, themeClass);
      }
    }

    switch (theme) {
      case 'dark-theme':
        this.renderer.addClass(el, DARK_THEME_CLASS);
        break;
      case 'light-theme':
        this.renderer.addClass(el, LIGHT_THEME_CLASS);
        break;
    }
  }
}
