/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {ChangeDetectionStrategy, Component, inject, input} from '@angular/core';
import {DocContent, DocViewer} from '@angular/docs';
import {ApiItemType} from './../interfaces/api-item-type';
import {ReferenceScrollHandler} from '../services/reference-scroll-handler.service';
import {API_SECTION_CLASS_NAME} from '../constants/api-reference-prerender.constants';
import {AppScroller} from '../../../app-scroller';

@Component({
  selector: 'adev-reference-page',
  standalone: true,
  imports: [DocViewer],
  templateUrl: './api-reference-details-page.component.html',
  styleUrls: ['./api-reference-details-page.component.scss'],
  providers: [ReferenceScrollHandler],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ApiReferenceDetailsPage {
  private readonly scrollHandler = inject(ReferenceScrollHandler);
  private readonly appScroller = inject(AppScroller);

  docContent = input<DocContent | undefined>();
  tab = input<string | undefined>();

  // aliases
  ApiItemType = ApiItemType;

  constructor() {
    this.appScroller.disableScrolling = true;
  }

  ngOnDestroy() {
    this.appScroller.disableScrolling = false;
  }

  membersCardsLoaded(): void {
    this.scrollHandler.setupListeners(API_SECTION_CLASS_NAME);
  }
}
