import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  viewChildren,
} from '@angular/core';
import {Animation, AnimationCreatorService, AnimationLayerDirective} from '../home/animation';
import {AnimationPlayerComponent} from '../home/animation/plugins/animation-player.component';
import {ANIMATION_DEFINITION} from './animation-definition';

@Component({
  selector: 'adev-anim-test',
  imports: [AnimationLayerDirective, AnimationPlayerComponent],
  templateUrl: './anim-test.component.html',
  styleUrl: './anim-test.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AnimationCreatorService],
})
export class AnimTestComponent implements AfterViewInit {
  private readonly _animCreator = inject(AnimationCreatorService);

  animationLayers = viewChildren(AnimationLayerDirective);
  animation = signal<Animation | null>(null);

  ngAfterViewInit(): void {
    const animation = this._animCreator
      .createAnimation(this.animationLayers(), {
        timestep: 10,
        emitFrameUpdateEvents: true,
      })
      .define(ANIMATION_DEFINITION);

    this.animation.set(animation);
  }
}
