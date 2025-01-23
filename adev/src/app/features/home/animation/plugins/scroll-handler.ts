import {Animation} from '../animation';
import {AnimationPlugin} from './plugin';

export class ScrollHandler implements AnimationPlugin {
  constructor(public animation: Animation) {}
}
