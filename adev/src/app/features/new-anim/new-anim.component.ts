import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  inject,
  Injector,
  viewChildren,
  ViewContainerRef,
} from '@angular/core';
import {Animation, AnimationCreatorService, AnimationLayerDirective} from '../home/animation';
import {AnimationPlayer} from '../home/animation/plugins/animation-player';
import {AnimationScrollHandler} from '../home/animation/plugins/animation-scroll-handler';
import {DEFINITION} from './definition';

@Component({
  selector: 'adev-new-anim',
  imports: [AnimationLayerDirective],
  templateUrl: './new-anim.component.html',
  styleUrl: './new-anim.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AnimationCreatorService],
})
export class NewAnimComponent implements AfterViewInit {
  private readonly _animCreator = inject(AnimationCreatorService);
  private readonly _vcr = inject(ViewContainerRef);
  private readonly _injector = inject(Injector);
  private _animation?: Animation;

  animationLayers = viewChildren(AnimationLayerDirective);

  ngAfterViewInit() {
    this._animation = this._animCreator
      .createAnimation(this.animationLayers(), {
        timestep: 10,
      })
      .define(DEFINITION)
      .addPlugin(new AnimationPlayer(this._vcr))
      .addPlugin(new AnimationScrollHandler(this._vcr, this._injector));
  }

  ngOnDestroy() {
    this._animation?.dispose();
  }
}
