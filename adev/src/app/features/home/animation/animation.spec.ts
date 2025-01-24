import {AfterViewInit, Component, inject, viewChildren} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {AnimationLayerDirective} from './animation-layer.directive';
import {AnimationCreatorService} from './animation-creator.service';
import {Animation} from './animation';
import {AnimationDefinition} from './types';

// Test component
@Component({
  selector: 'adev-animation-host',
  imports: [AnimationLayerDirective],
  providers: [AnimationCreatorService],
  template: `
    <div adevAnimationLayer layerId="layer-1">
      <div class="circle"></div>
    </div>
    <div adevAnimationLayer layerId="layer-2">
      <div class="square"></div>
    </div>
  `,
})
class AnimationHost implements AfterViewInit {
  private _animationCreator = inject(AnimationCreatorService);
  layers = viewChildren(AnimationLayerDirective);
  animation!: Animation;

  ngAfterViewInit() {
    this.animation = this._animationCreator.createAnimation(this.layers());
  }
}

// Animation definition
const definition: AnimationDefinition = [
  {
    selector: 'layer-1 >> .circle',
    timespan: [0, 4],
    from: {
      'opacity': '0',
      'transform': 'translateX(0)',
    },
    to: {
      'opacity': '1',
      'transform': 'translateX(100%)',
    },
  },
  {
    selector: 'layer-2 >> .square',
    timespan: [1, 5],
    from: {
      'font-size': '20px',
      'color': '#000',
    },
    to: {
      'font-size': '10px',
      'color': '#ffffff',
    },
  },
];

describe('Animation', () => {
  let component: AnimationHost;
  let fixture: ComponentFixture<AnimationHost>;
  let animation: Animation;
  const layerObjects = new Map<string, HTMLElement>();

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnimationHost],
    }).compileComponents();

    fixture = TestBed.createComponent(AnimationHost);
    component = fixture.componentInstance;
    fixture.detectChanges();
    animation = component.animation;

    // Store all layer objects in a map for easier access.
    for (const l of component.layers()) {
      const layerEl = l.elementRef.nativeElement as HTMLElement;
      layerObjects.set(l.id(), layerEl);

      const layerObj = layerEl.firstChild as HTMLElement;
      layerObjects.set('.' + layerObj.className, layerObj);
    }
  });

  it('should load the layers and initialize the animation', () => {
    expect(animation).toBeTruthy();
    expect(layerObjects.get('layer-1')).toBeInstanceOf(HTMLElement);
    expect(layerObjects.get('.circle')).toBeInstanceOf(HTMLElement);
    expect(layerObjects.get('layer-2')).toBeInstanceOf(HTMLElement);
    expect(layerObjects.get('.square')).toBeInstanceOf(HTMLElement);
  });

  it(`should throw an error if a layer doesn't exist`, () => {
    const defineFn = () =>
      animation.define([
        {
          selector: 'layer-3',
          at: 1,
          styles: {},
        },
      ]);

    expect(defineFn).toThrowError('Animation: Missing layer ID: layer-3');
  });

  it(`should throw an error if a layer object doesn't exist`, () => {
    const defineFn = () =>
      animation.define([
        {
          selector: 'layer-1 >> .triangle',
          at: 1,
          styles: {},
        },
      ]);

    expect(defineFn).toThrowError('Animation: Missing layer object: layer-1 >> .triangle');
  });

  it('should throw an error if there is a mismatch between the number of "from" and "to" styles', () => {
    const defineFn = () =>
      animation.define([
        {
          selector: 'layer-1 >> .circle',
          timespan: [0, 1],
          from: {
            'background': '#000',
            'opacity': '0.5',
          },
          to: {
            'background': '#fff',
          },
        },
      ]);

    expect(defineFn).toThrowError(
      `Animation: There is a mismatch between the number of "from" and "to" styles for selector 'layer-1 >> .circle'`,
    );
  });

  it('should throw an error if there is a mismatch between the "from" and "to" styles properties', () => {
    const defineFn = () =>
      animation.define([
        {
          selector: 'layer-1 >> .circle',
          timespan: [0, 1],
          from: {
            'background': '#000',
            'opacity': '0.5',
          },
          to: {
            'background': '#fff',
            'transform': 'scale(2)',
          },
        },
      ]);

    expect(defineFn).toThrowError(
      `Animation: "from" style 'transform' is missing for selector 'layer-1 >> .circle'`,
    );
  });

  it('should return animation duration', () => {
    animation.define([
      {
        selector: 'layer-2 >> .square',
        timespan: [3, 7],
        from: {},
        to: {},
      },
      {
        selector: 'layer-1 >> .circle',
        timespan: [0, 5],
        from: {},
        to: {},
      },
    ]);

    expect(animation.duration).toEqual(7000);
  });

  it('should return animation duration (single rule)', () => {
    animation.define([
      {
        selector: 'layer-2 >> .square',
        at: 3,
        styles: {},
      },
    ]);

    expect(animation.duration).toEqual(3000);
  });

  it('should move the animation forward in time', () => {
    animation.define(definition);
    animation.forward(2000);

    const circle = layerObjects.get('.circle');

    expect(circle?.style.opacity).toEqual('0.5');
    expect(circle?.style.transform).toEqual('translateX(50%)');

    const square = layerObjects.get('.square');

    expect(square?.style.fontSize).toEqual('17.5px');
    expect(square?.style.color).toEqual('rgb(64, 64, 64)');
  });

  it('should move the animation back in time', () => {
    animation.define(definition);
    animation.forward(5000);
    animation.back(2000);

    const circle = layerObjects.get('.circle');

    expect(circle?.style.opacity).toEqual('0.75');
    expect(circle?.style.transform).toEqual('translateX(75%)');

    const square = layerObjects.get('.square');

    expect(square?.style.fontSize).toEqual('15px');
    expect(square?.style.color).toEqual('rgb(128, 128, 128)');
  });

  it('should seek', () => {
    animation.define(definition);
    animation.seek(4 / 5); // 4th second; 0.8

    const circle = layerObjects.get('.circle');

    expect(circle?.style.opacity).toEqual('1');
    expect(circle?.style.transform).toEqual('translateX(100%)');

    const square = layerObjects.get('.square');

    expect(square?.style.fontSize).toEqual('12.5px');
    expect(square?.style.color).toEqual('rgb(191, 191, 191)');
  });

  it('should reset the animation', () => {
    animation.define(definition);
    animation.seek(1);
    animation.reset();

    const circle = layerObjects.get('.circle');

    // i.e. CSS styles are in use

    expect(circle?.style.opacity).toEqual('');
    expect(circle?.style.transform).toEqual('');

    const square = layerObjects.get('.square');

    expect(square?.style.fontSize).toEqual('');
    expect(square?.style.color).toEqual('');
  });

  it('should animate layers', () => {
    animation.define([
      {
        selector: 'layer-1',
        timespan: [0, 1],
        from: {
          'padding': '0',
        },
        to: {
          'padding': '32px',
        },
      },
    ]);
    animation.seek(0.5);

    const layer1 = layerObjects.get('layer-1');

    expect(layer1?.style.padding).toEqual('16px');
  });
});
