import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  inject,
  viewChildren,
  ViewContainerRef,
} from '@angular/core';
import {AnimationCreatorService, AnimationLayerDirective} from '../home/animation';
import {ANIMATION_DEFINITION} from './animation-definition';
import {AnimationPlayer} from '../home/animation/plugins/animation-player';

@Component({
  selector: 'adev-anim-test',
  imports: [AnimationLayerDirective],
  templateUrl: './anim-test.component.html',
  styleUrl: './anim-test.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AnimationCreatorService],
})
export class AnimTestComponent implements AfterViewInit {
  private readonly _animCreator = inject(AnimationCreatorService);
  private readonly _vcr = inject(ViewContainerRef);

  animationLayers = viewChildren(AnimationLayerDirective);

  ngAfterViewInit() {
    this._animCreator
      .createAnimation(this.animationLayers(), {
        timestep: 10,
      })
      .define(ANIMATION_DEFINITION)
      .addPlugin(new AnimationPlayer(this._vcr));
  }
}
