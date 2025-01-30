import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  inject,
  Injector,
  viewChildren,
  ViewContainerRef,
} from '@angular/core';
import {WINDOW} from '@angular/docs';

import {Animation, AnimationCreatorService, AnimationLayerDirective} from '../home/animation';
import {AnimationPlayer} from '../home/animation/plugins/animation-player';
import {AnimationScrollHandler} from '../home/animation/plugins/animation-scroll-handler';
import {generateHomeAnimationDefinition} from './definition';

// In pixels. Keep in sync with the SCSS file.
const METEOR_WIDTH = 120;
const METEOR_HEIGHT = 170;
const METEOR_GAP = 85;

@Component({
  selector: 'adev-new-anim',
  imports: [AnimationLayerDirective],
  templateUrl: './new-anim.component.html',
  styleUrl: './new-anim.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AnimationCreatorService],
})
export class NewAnimComponent implements AfterViewInit {
  private readonly _win = inject(WINDOW);
  private readonly _animCreator = inject(AnimationCreatorService);
  private readonly _vcr = inject(ViewContainerRef);
  private readonly _injector = inject(Injector);
  private _animation?: Animation;
  private _meteorsCount = this._calcMeteorsCount();

  animationLayers = viewChildren(AnimationLayerDirective);
  meteors = new Array(this._meteorsCount).fill(null);

  ngAfterViewInit() {
    this._animation = this._animCreator
      .createAnimation(this.animationLayers(), {
        timestep: 10,
      })
      .define(generateHomeAnimationDefinition(this._win.innerWidth / this._win.innerHeight))
      .addPlugin(new AnimationPlayer(this._vcr))
      .addPlugin(new AnimationScrollHandler(this._vcr, this._injector));
  }

  ngOnDestroy() {
    this._animation?.dispose();
  }

  private _calcMeteorsCount() {
    const winW = this._win.innerWidth;
    const winH = this._win.innerHeight;
    const mW = METEOR_WIDTH + METEOR_GAP;
    const mH = METEOR_HEIGHT + METEOR_GAP;
    let rows = 1;
    let cols = 1;

    while (rows * mW < winW) {
      rows++;
    }
    while (cols * mH < winH) {
      cols++;
    }

    return (rows + 1) * cols;
  }
}
