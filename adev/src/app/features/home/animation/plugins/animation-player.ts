import {ComponentRef, ViewContainerRef} from '@angular/core';
import {Animation} from '../animation';
import {AnimationPlugin} from './types';
import {AnimationPlayerComponent} from './animation-player.component';

export class AnimationPlayer implements AnimationPlugin {
  private _cmpRef?: ComponentRef<AnimationPlayerComponent>;

  /**
   * USED FOR ANIMATION DEVELOPMENT.
   * Remove imports to this file before shipping the animation.
   *
   * Animation player.
   *
   * @param _hostVcr VCR of the animation host component.
   */
  constructor(private _hostVcr: ViewContainerRef) {}

  init(animation: Animation) {
    this._cmpRef = this._hostVcr.createComponent(AnimationPlayerComponent);
    this._cmpRef.instance.animation.set(animation);
  }

  destroy() {
    this._cmpRef?.destroy();
  }
}
