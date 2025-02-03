import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  Injector,
  viewChildren,
  ViewContainerRef,
} from '@angular/core';
import {RouterLink} from '@angular/router';
import {WINDOW, isIos} from '@angular/docs';

import {Animation, AnimationCreatorService, AnimationLayerDirective} from '../../animation';
import {AnimationPlayer} from '../../animation/plugins/animation-player';
import {AnimationScrollHandler} from '../../animation/plugins/animation-scroll-handler';
import {generateHomeAnimationDefinition} from './animation-definition';

export const METEOR_SIZE_RATIO = 1.42;
export const METEOR_GAP_RATIO = 1.33; // Use 0.7 for WebGL-like field. Renders a lot of elements though.

// A map with screen size to meteor width
export const METEOR_WIDTH_MAP = [
  [800, 80],
  [1100, 100],
];

export const METEOR_WIDTH_DEFAULT = 120; // For screens larger than 1100px

type MeteorDimensions = {
  width: number;
  height: number;
  tailLength: number;
  gap: number;
  tiltAngle: number; // In radians
};

type MeteorFieldData = {
  width: number;
  height: number;
  count: number;
  marginLeft: number;
  marginTop: number;
};

@Component({
  selector: 'adev-home-animation',
  imports: [AnimationLayerDirective, RouterLink],
  templateUrl: './home-animation.component.html',
  styleUrl: './home-animation.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AnimationCreatorService],
})
export class HomeAnimationComponent implements AfterViewInit {
  private readonly _win = inject(WINDOW);
  private readonly _animCreator = inject(AnimationCreatorService);
  private readonly _vcr = inject(ViewContainerRef);
  private readonly _injector = inject(Injector);
  private readonly _elementRef = inject(ElementRef);
  private _animation?: Animation;

  readonly animationLayers = viewChildren(AnimationLayerDirective);
  readonly ctaLink = isIos ? 'overview' : 'tutorials/learn-angular';

  meteorFieldData: MeteorFieldData;
  meteors: null[];

  constructor() {
    // Limitation: Meteor dimensions won't change on page resize
    const meteorDimensions = this._calculateMeteorDimensions();
    this._setCssVariables(meteorDimensions);
    this.meteorFieldData = this._calculateMeteorFieldData(meteorDimensions);
    this.meteors = new Array(this.meteorFieldData.count).fill(null);
  }

  ngAfterViewInit() {
    this._animation = this._animCreator
      .createAnimation(this.animationLayers(), {
        timestep: 10,
      })
      .define(generateHomeAnimationDefinition(this.meteors.length))
      .addPlugin(new AnimationPlayer(this._vcr, 'right'))
      .addPlugin(new AnimationScrollHandler(this._elementRef, this._injector));
  }

  ngOnDestroy() {
    this._animation?.dispose();
  }

  private _calculateMeteorDimensions(): MeteorDimensions {
    let width = METEOR_WIDTH_DEFAULT;

    for (const [screenSize, meteorWidth] of METEOR_WIDTH_MAP) {
      if (this._win.innerWidth <= screenSize) {
        width = meteorWidth;
      }
    }

    const height = width * METEOR_SIZE_RATIO;
    const gap = width * METEOR_GAP_RATIO;

    // Pythagorean theorem + some trigonometry
    const tailLength = Math.sqrt(width * width + height * height);
    const tiltAngle = -Math.asin(width / tailLength);

    return {
      width,
      height,
      gap,
      tailLength,
      tiltAngle,
    };
  }

  private _calculateMeteorFieldData(meteorDim: MeteorDimensions): MeteorFieldData {
    const mW = meteorDim.width + meteorDim.gap;
    const mH = meteorDim.height + meteorDim.gap;
    let rows = 1;
    let cols = 1;

    while (cols * mW - meteorDim.gap <= this._win.innerWidth) {
      cols++;
    }
    while (rows * mH - meteorDim.gap <= this._win.innerHeight) {
      rows++;
    }

    const width = cols * mW - meteorDim.gap;
    const height = rows * mH - meteorDim.gap;

    return {
      count: rows * cols,
      width,
      height,
      marginLeft: -(width - this._win.innerWidth) / 2,
      marginTop: -(height - this._win.innerHeight) / 2,
    };
  }

  private _setCssVariables({width, height, tailLength, tiltAngle, gap}: MeteorDimensions) {
    const styleRef = this._elementRef.nativeElement.style;
    styleRef.setProperty('--anim-meteor-width', width + 'px');
    styleRef.setProperty('--anim-meteor-height', height + 'px');
    styleRef.setProperty('--anim-meteor-tail-length', tailLength + 'px');
    styleRef.setProperty('--anim-meteor-tilt-angle', tiltAngle + 'rad');
    styleRef.setProperty('--anim-meteor-gap', gap + 'px');
  }
}
