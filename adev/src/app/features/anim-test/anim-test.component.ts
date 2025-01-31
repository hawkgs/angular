import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  Injector,
  OnDestroy,
  viewChildren,
  ViewContainerRef,
} from '@angular/core';
import {Animation, AnimationCreatorService, AnimationLayerDirective} from '../home/animation';
import {ANIMATION_DEFINITION} from './animation-definition';
import {AnimationPlayer} from '../home/animation/plugins/animation-player';
import {AnimationScrollHandler} from '../home/animation/plugins/animation-scroll-handler';

@Component({
  selector: 'adev-anim-test',
  imports: [AnimationLayerDirective],
  templateUrl: './anim-test.component.html',
  styleUrl: './anim-test.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AnimationCreatorService],
})
export class AnimTestComponent implements AfterViewInit, OnDestroy {
  private readonly _animCreator = inject(AnimationCreatorService);
  private readonly _vcr = inject(ViewContainerRef);
  private readonly _elementRef = inject(ElementRef);
  private readonly _injector = inject(Injector);
  private _animation?: Animation;

  animationLayers = viewChildren(AnimationLayerDirective);

  ngAfterViewInit() {
    this._animation = this._animCreator
      .createAnimation(this.animationLayers(), {
        timestep: 10,
      })
      .define(ANIMATION_DEFINITION)
      .addPlugin(new AnimationPlayer(this._vcr))
      .addPlugin(new AnimationScrollHandler(this._elementRef, this._injector));
  }

  ngOnDestroy() {
    this._animation?.dispose();
  }
}
