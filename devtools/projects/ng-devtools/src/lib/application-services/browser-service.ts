/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {inject, Injectable, RendererFactory2} from '@angular/core';
import {DOCUMENT} from '@angular/common';
import {WINDOW} from '../application-providers/window-provider';

export type Browser = 'chrome' | 'firefox' | 'safari' | 'unknown';

// Keep class names in sync with _theme.scss
const BROWSER_CLASS_NAME: {[key in Browser]: string} = {
  'chrome': 'chrome-ui',
  'firefox': 'firefox-ui',
  'safari': 'safari-ui',
  'unknown': 'chrome-ui',
};

@Injectable()
export class BrowserService {
  private readonly _win = inject(WINDOW);
  private readonly _doc = inject(DOCUMENT);
  private readonly _rendererFactory = inject(RendererFactory2);
  private readonly _renderer = this._rendererFactory.createRenderer(null, null);

  private _browser: Browser = 'unknown';

  get browser() {
    return this._browser;
  }

  setBrowserUiClass() {
    this._browser = this._detectBrowser();
    const browserClass = BROWSER_CLASS_NAME[this._browser];
    this._renderer.addClass(this._doc.body, browserClass);
  }

  private _detectBrowser(): Browser {
    const ua = this._win.navigator.userAgent;
    if (ua.includes('Chrome')) {
      return 'chrome';
    }
    if (ua.includes('Firefox')) {
      return 'firefox';
    }
    if (ua.includes('Safari')) {
      return 'safari';
    }
    return 'unknown';
  }
}
