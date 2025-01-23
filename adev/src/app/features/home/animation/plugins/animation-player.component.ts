/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {Component, input} from '@angular/core';
import {AnimationPlugin} from './plugin';
import {Animation} from '../animation';

const TIMESTEP = 100;

/**
 * USED FOR ANIMATION DEVELOPMENT. REMOVE IMPORTS BEFORE SHIPPING THE ANIMATION.
 *
 * Animation player.
 */
@Component({
  selector: 'adev-animation-player',
  template: `
    @let anim = animation();
    <div class="controls">
      <button (click)="anim.back(TIMESTEP)" title="Go back">⏪</button>
      <button (click)="playPause()" [attr.title]="!anim.isPlaying() ? 'Play' : 'Pause'">
        {{ !anim.isPlaying() ? '▶️' : '⏸️' }}
      </button>
      <button (click)="anim.stop()" title="Stop">⏹️</button>
      <button (click)="anim.forward(TIMESTEP)" title="Go forward">⏩</button>
    </div>
  `,
  styles: `
    .controls {
      position: fixed;
      left: 50%;
      transform: translateX(-50%);
      bottom: 30px;
      display: flex;
      gap: 16px;
    }
    button {
      width: 50px;
      height: 50px;
      border-radius: 10px;
      background-color: #333;
      font-size: 20px;
    }
    button:hover {
      background-color: #444;
    }
  `,
})
export class AnimationPlayerComponent implements AnimationPlugin {
  animation = input.required<Animation>();
  TIMESTEP = TIMESTEP;

  playPause() {
    if (!this.animation().isPlaying()) {
      this.animation().play();
    } else {
      this.animation().pause();
    }
  }
}
