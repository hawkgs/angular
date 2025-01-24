import {ViewContainerRef} from '@angular/core';
import {Animation} from '../animation';
import {AnimationPlugin} from './types';
import {AnimationPlayerComponent} from './animation-player.component';

/**
 * USED FOR ANIMATION DEVELOPMENT.
 * REMOVE IMPORTS TO THIS FILE BEFORE SHIPPING THE ANIMATION.
 *
 * Animation player.
 */
export class AnimationPlayer implements AnimationPlugin {
  constructor(private _hostVcr: ViewContainerRef) {}

  init(animation: Animation) {
    const cmpRef = this._hostVcr.createComponent(AnimationPlayerComponent);
    cmpRef.instance.animation.set(animation);
  }
}
