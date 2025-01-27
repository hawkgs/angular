import {Injector, Renderer2, RendererFactory2, ViewContainerRef} from '@angular/core';
import {WINDOW} from '@angular/docs';
import {DOCUMENT} from '@angular/common';
import {Animation} from '../animation';
import {AnimationPlugin} from './types';

export class AnimationScrollHandler implements AnimationPlugin {
  private _win: Window;
  private _doc: Document;
  private _renderer: Renderer2;
  private _unlisten: (() => void) | null = null;

  constructor(
    private _vcr: ViewContainerRef,
    injector: Injector,
  ) {
    this._win = injector.get(WINDOW);
    this._doc = injector.get(DOCUMENT);
    this._renderer = injector.get(RendererFactory2).createRenderer(null, null);
  }

  init(animation: Animation) {
    // Calculate the total scroll height needed for the animation
    const scrollHeight = animation.duration / animation.timestep;
    this._createSpacer(scrollHeight);

    this._unlisten = this._renderer.listen(this._win, 'scroll', () => {
      if (animation.isPlaying()) {
        animation.pause();
      }
      const progress = this._win.scrollY / scrollHeight;
      animation.seek(progress);
    });
  }

  destroy() {
    if (this._unlisten) {
      this._unlisten();
    }
  }

  /** Creates a spacer that occupies/creates the scrollable space needed for the animation. */
  private _createSpacer(scrollHeight: number) {
    // Create the spacer and append it to the body.
    const spacer = this._renderer.createElement('div');
    this._renderer.addClass(spacer, 'anim-scroll-spacer');
    this._renderer.setStyle(spacer, 'height', scrollHeight + 'px');

    this._vcr.element.nativeElement.appendChild(spacer);

    // Calculate the height of the rest of the elements that
    // has to be added to the spacer height.
    // Note: it is assumed that scrollHeight > window.innerHeight
    const otherElementsHeight = this._doc.body.scrollHeight - scrollHeight;
    const spacerHeight = scrollHeight + this._win.innerHeight - otherElementsHeight;

    // Update the height with the final one.
    this._renderer.setStyle(spacer, 'height', spacerHeight + 'px');
  }
}
