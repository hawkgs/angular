import {ElementRef, Injector, Renderer2, RendererFactory2} from '@angular/core';
import {WINDOW} from '@angular/docs';
import {Animation} from '../animation';
import {AnimationPlugin} from './types';

const RESIZE_DEBOUNCE = 500;

export class AnimationScrollHandler implements AnimationPlugin {
  private _win: Window;
  private _renderer: Renderer2;
  private _unlisteners: (() => void)[] = [];
  private _scrollHeight: number = 0;
  private _spacer?: HTMLElement;
  private _resizeDebounceTimeout?: ReturnType<typeof setTimeout>;

  /**
   * Enables page scroll control over the animation.
   *
   * @param _hostElementRef `ElementRef` of the animation host component.
   * @param injector
   */
  constructor(
    private _hostElementRef: ElementRef,
    injector: Injector,
  ) {
    this._win = injector.get(WINDOW);
    this._renderer = injector.get(RendererFactory2).createRenderer(null, null);
  }

  init(animation: Animation) {
    // Calculate the total scroll height needed for the animation.
    this._scrollHeight = animation.duration / animation.timestep;

    this._createSpacer();

    this._unlisteners = [
      this._renderer.listen(this._win, 'scroll', () => {
        if (animation.isPlaying()) {
          animation.pause();
        }
        const progress = this._win.scrollY / this._scrollHeight;
        animation.seek(progress);
      }),
      this._renderer.listen(this._win, 'resize', () => {
        if (this._resizeDebounceTimeout) {
          clearTimeout(this._resizeDebounceTimeout);
        }
        this._resizeDebounceTimeout = setTimeout(
          () => requestAnimationFrame(() => this._updateSpacerHeight()),
          RESIZE_DEBOUNCE,
        );
      }),
    ];
  }

  destroy() {
    for (const unlisten of this._unlisteners) {
      unlisten();
    }
  }

  /** Creates and stores a spacer that occupies/creates the scrollable space needed for the animation. */
  private _createSpacer() {
    // Create the spacer and append it to the body.
    this._spacer = this._renderer.createElement('div');
    this._renderer.addClass(this._spacer, 'anim-scroll-spacer');
    this._updateSpacerHeight();

    this._hostElementRef.nativeElement.appendChild(this._spacer);
  }

  /** Update stored spacer's height. */
  private _updateSpacerHeight() {
    const spacerHeight = this._scrollHeight + this._win.innerHeight;
    this._renderer.setStyle(this._spacer, 'height', spacerHeight + 'px');
  }
}
