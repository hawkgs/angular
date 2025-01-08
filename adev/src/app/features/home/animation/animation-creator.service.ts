/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {Injectable} from '@angular/core';
import {Animation} from './animation';
import {AnimationLayerDirective} from './animation-layer.directive';
import {AnimationConfig} from './types';

@Injectable()
export class AnimationCreatorService {
  /**
   *
   * @param layers
   * @param config
   * @returns
   */
  createAnimation(layers: AnimationLayerDirective[], config?: AnimationConfig): Animation {
    return new Animation(layers, config);
  }
}
