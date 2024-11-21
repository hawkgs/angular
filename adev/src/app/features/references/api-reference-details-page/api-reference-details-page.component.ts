/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {ChangeDetectionStrategy, Component, inject, input} from '@angular/core';
import {DOCUMENT, Location} from '@angular/common';
import {DocContent, DocViewer} from '@angular/docs';
import {ApiItemType} from './../interfaces/api-item-type';
import {AppScroller} from '../../../app-scroller';

@Component({
  selector: 'adev-reference-page',
  standalone: true,
  imports: [DocViewer],
  templateUrl: './api-reference-details-page.component.html',
  styleUrls: ['./api-reference-details-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ApiReferenceDetailsPage {
  private readonly appScroller = inject(AppScroller);
  private readonly location = inject(Location);
  private readonly document = inject(DOCUMENT);

  docContent = input<DocContent | undefined>();

  // aliases
  ApiItemType = ApiItemType;

  constructor() {
    this.appScroller.disableScrolling = true;
  }

  ngOnDestroy() {
    this.appScroller.disableScrolling = false;
  }

  onContentLoaded() {
    this.scrollToSectionId();
  }

  private scrollToSectionId() {
    const [_, sectionId] = this.location.path(true).split('#');
    if (sectionId) {
      const sectionHeading = this.document.getElementById(sectionId);
      sectionHeading?.scrollIntoView({behavior: 'instant'});
    }
  }
}
