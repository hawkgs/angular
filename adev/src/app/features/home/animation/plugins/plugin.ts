/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {Signal} from '@angular/core';
import {Animation} from '../animation';

export interface AnimationPlugin {
  animation: Animation | Signal<Animation>;
}
