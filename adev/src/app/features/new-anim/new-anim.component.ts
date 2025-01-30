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
import {METEOR_GAP, METEOR_HEIGHT, METEOR_WIDTH} from './constants';

type MeteorFieldData = {
  width: number;
  height: number;
  count: number;
  marginLeft: number;
  marginTop: number;
};

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

  animationLayers = viewChildren(AnimationLayerDirective);
  meteorFieldData: MeteorFieldData;
  meteors: null[];

  constructor() {
    this.meteorFieldData = this._calculateMeteorFieldData();
    this.meteors = new Array(this.meteorFieldData.count).fill(null);
  }

  ngAfterViewInit() {
    this._animation = this._animCreator
      .createAnimation(this.animationLayers(), {
        timestep: 10,
      })
      .define(generateHomeAnimationDefinition(this.meteors.length))
      .addPlugin(new AnimationPlayer(this._vcr))
      .addPlugin(new AnimationScrollHandler(this._vcr, this._injector));
  }

  ngOnDestroy() {
    this._animation?.dispose();
  }

  private _calculateMeteorFieldData(): MeteorFieldData {
    const mW = METEOR_WIDTH + METEOR_GAP;
    const mH = METEOR_HEIGHT + METEOR_GAP;
    let rows = 1;
    let cols = 1;

    while (cols * mW - METEOR_GAP <= this._win.innerWidth) {
      cols++;
    }
    while (rows * mH - METEOR_GAP <= this._win.innerHeight) {
      rows++;
    }

    const width = cols * mW - METEOR_GAP;
    const height = rows * mH - METEOR_GAP;

    return {
      count: rows * cols,
      width,
      height,
      marginLeft: -(width - this._win.innerWidth) / 2,
      marginTop: -(height - this._win.innerHeight) / 2,
    };
  }
}
