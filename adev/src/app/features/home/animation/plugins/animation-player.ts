import {ComponentRef, ViewContainerRef} from '@angular/core';
import {Animation} from '../animation';
import {AnimationPlugin} from './types';
import {AnimationPlayerComponent, ComponentAlignment} from './animation-player.component';

export class AnimationPlayer implements AnimationPlugin {
  private _cmpRef?: ComponentRef<AnimationPlayerComponent>;

  /**
   * USED FOR ANIMATION DEVELOPMENT.
   * Remove imports to this file before shipping the animation.
   *
   * Animation player.
   *
   * @param _hostVcr VCR of the animation host component.
   * @param alignment Alignment of the player. Default: `center`
   */
  constructor(
    private _hostVcr: ViewContainerRef,
    private _alignment?: ComponentAlignment,
  ) {}

  init(animation: Animation) {
    this._cmpRef = this._hostVcr.createComponent(AnimationPlayerComponent);
    this._cmpRef.instance.animation.set(animation);
    this._cmpRef.instance.alignment.set(this._alignment || 'center');
  }

  destroy() {
    this._cmpRef?.destroy();
  }
}
