import {Injector, Renderer2, RendererFactory2, ViewContainerRef} from '@angular/core';
import {WINDOW} from '@angular/docs';
import {DOCUMENT} from '@angular/common';
import {Animation} from '../animation';
import {AnimationPlugin} from './types';

const RESIZE_DEBOUNCE = 500;

export class AnimationScrollHandler implements AnimationPlugin {
  private _win: Window;
  private _doc: Document;
  private _renderer: Renderer2;
  private _unlisteners: (() => void)[] = [];
  private _scrollHeight: number = 0;
  private _otherElementsHeight: number = 0;
  private _spacer?: HTMLElement;
  private _resizeDebounceTimeout?: ReturnType<typeof setTimeout>;

  /**
   * Enables page scroll control over the animation.
   *
   * @param _hostVcr VCR of the animation host component.
   * @param injector
   */
  constructor(
    private _hostVcr: ViewContainerRef,
    injector: Injector,
  ) {
    this._win = injector.get(WINDOW);
    this._doc = injector.get(DOCUMENT);
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
    const spacer = this._renderer.createElement('div');
    this._renderer.addClass(spacer, 'anim-scroll-spacer');

    // Since we might have other elements in the viewport,
    // we set the spacer exactly to the viewport height ...
    this._renderer.setStyle(spacer, 'height', this._win.innerHeight + 'px');
    this._hostVcr.element.nativeElement.appendChild(spacer);

    // ... and then we subtract it from the total scroll height ...
    this._otherElementsHeight = this._doc.body.scrollHeight - this._win.innerHeight;
    this._spacer = spacer;

    // ... finally, we update the spacer with the
    this._updateSpacerHeight();
  }

  /** Update stored spacer's height. */
  private _updateSpacerHeight() {
    // Ensures that we have exactly `scrollHeight` scrollable pixels in the viewport.
    const spacerHeight = this._scrollHeight + this._win.innerHeight - this._otherElementsHeight;
    this._renderer.setStyle(this._spacer, 'height', spacerHeight + 'px');
  }
}
