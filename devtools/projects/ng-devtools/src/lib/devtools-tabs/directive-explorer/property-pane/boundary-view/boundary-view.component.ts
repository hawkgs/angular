/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {Component, computed, input} from '@angular/core';
import {BoundaryBlock} from '../../../../../../../protocol';

@Component({
  selector: 'ng-boundary-view',
  templateUrl: './boundary-view.component.html',
  styleUrl: './boundary-view.component.scss',
})
export class BoundaryViewComponent {
  protected readonly boundary = input.required<NonNullable<BoundaryBlock>>();

  protected readonly printableError = computed(() => {
    const error = this.boundary().error;
    if (error == null) {
      return null;
    }

    if (error instanceof Error) {
      return error.stack;
    }
    return error;
  });
}
