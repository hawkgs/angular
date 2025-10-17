/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {
  afterRenderEffect,
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  Directive,
  ElementRef,
  inject,
  input,
  output,
  resource,
  signal,
  TemplateRef,
  viewChild,
  ViewContainerRef,
  ViewEncapsulation,
} from '@angular/core';

import {ZippyComponent} from './zippy.component';
import {HeavyComponent} from './heavy.component';
import {SamplePropertiesComponent} from './sample-properties.component';
import {RouterOutlet} from '@angular/router';
import {CookieRecipe} from './cookies.component';

// structual directive example
@Directive({
  selector: '[appStructural]',
  host: {
    '[class.app-structural]': 'true',
  },
})
export class StructuralDirective {
  templateRef = inject(TemplateRef);
  viewContainerRef = inject(ViewContainerRef);

  ngOnInit() {
    // Example of using the structural directive
    this.viewContainerRef.createEmbeddedView(this.templateRef);
  }
}

@Component({
  selector: 'app-demo-component',
  templateUrl: './demo-app.component.html',
  styleUrls: ['./demo-app.component.scss'],
  encapsulation: ViewEncapsulation.None,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    StructuralDirective,
    HeavyComponent,
    SamplePropertiesComponent,
    RouterOutlet,
    CookieRecipe,
  ],
})
export class DemoAppComponent {
  readonly zippy = viewChild(ZippyComponent);
  readonly elementRef = viewChild<ElementRef>('elementReference');

  readonly inputOne = input('input one', {alias: 'input_one'});
  readonly inputTwo = input('input two');

  readonly outputOne = output();
  readonly outputTwo = output({alias: 'output_two'});

  primitiveSignal = signal(123);
  primitiveComputed = computed(() => this.primitiveSignal() ** 2);
  objectSignal = signal({name: 'John', age: 40});
  objectComputed = computed(() => {
    const original = this.objectSignal();
    return {...original, age: original.age + 1};
  });

  counter = signal(1);

  rsrcParam = signal('rsrc_param');

  myRsrc = resource({
    params: () => this.rsrcParam(),
    loader: () => Promise.resolve('next_val'),
    debugName: 'myRsrc',
  });

  getTitle(): '► Click to expand' | '▼ Click to collapse' {
    if (!this.zippy() || !this.zippy()?.visible) {
      return '► Click to expand';
    }
    return '▼ Click to collapse';
  }

  constructor() {
    afterRenderEffect(() => {
      this.zippy();
    });
  }
}
