import {Injectable} from '@angular/core';
import {Animation, AnimationConfig} from './animation';
import {AnimationLayerDirective} from '../animation-layer.directive';

@Injectable()
export class AnimationCreatorService {
  createAnimation(layers: AnimationLayerDirective[], config?: AnimationConfig): Animation {
    return new Animation(layers, config);
  }
}
