import {ComponentRef, ViewContainerRef} from '@angular/core';
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
  private _cmpRef?: ComponentRef<AnimationPlayerComponent>;

  constructor(private _hostVcr: ViewContainerRef) {}

  init(animation: Animation) {
    this._cmpRef = this._hostVcr.createComponent(AnimationPlayerComponent);
    this._cmpRef.instance.animation.set(animation);
  }

  destroy() {
    this._cmpRef?.destroy();
  }
}
