/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {ChangeDetectionStrategy, Component, inject, input, computed} from '@angular/core';
import {DOCUMENT} from '@angular/common';
import {DocContent, DocViewer} from '@angular/docs';
import {ApiItemType} from './../interfaces/api-item-type';
import {ReferenceScrollHandler} from '../services/reference-scroll-handler.service';
import {
  API_REFERENCE_DETAILS_PAGE_HEADER_CLASS_NAME,
  API_REFERENCE_DETAILS_PAGE_MEMBERS_CLASS_NAME,
  API_REFERENCE_TAB_ATTRIBUTE,
  API_REFERENCE_TAB_API_LABEL,
  API_TAB_CLASS_NAME,
  API_REFERENCE_TAB_URL_ATTRIBUTE,
} from '../constants/api-reference-prerender.constants';
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
  private readonly document = inject(DOCUMENT);
  private readonly scrollHandler = inject(ReferenceScrollHandler);
  private readonly appScroller = inject(AppScroller);

  docContent = input<DocContent | undefined>();
  tab = input<string | undefined>();

  // aliases
  ApiItemType = ApiItemType;
  API_REFERENCE_TAB_API_LABEL = API_REFERENCE_TAB_API_LABEL;

  // computed state
  parsedDocContent = computed(() => {
    // TODO: pull this logic outside of a computed where it can be tested etc.
    const docContent = this.docContent();

    if (docContent === undefined) {
      return {
        header: undefined,
        members: undefined,
        sections: [],
      };
    }

    const element = this.document.createElement('div');
    element.innerHTML = docContent.contents;

    // Get the innerHTML of the header element from received document.
    const header = element.querySelector(API_REFERENCE_DETAILS_PAGE_HEADER_CLASS_NAME);
    // Get the innerHTML of the card elements from received document.
    const members = element.querySelector(API_REFERENCE_DETAILS_PAGE_MEMBERS_CLASS_NAME);

    // Get the page sections from the received document.
    // The tabs represent the sections.
    // We're expecting that tab element will contain `tab` attribute.
    const sections = Array.from(element.querySelectorAll(`[${API_REFERENCE_TAB_ATTRIBUTE}]`)).map(
      (tab) => ({
        id: tab.getAttribute(API_REFERENCE_TAB_URL_ATTRIBUTE)!,
        title: tab.getAttribute(API_REFERENCE_TAB_ATTRIBUTE)!,
        content: tab.innerHTML,
      }),
    );

    element.remove();

    return {
      header: header?.innerHTML,
      members: members?.innerHTML,
      sections,
    };
  });

  sections = () => this.parsedDocContent().sections;

  constructor() {
    this.appScroller.disableScrolling = true;
  }

  ngOnDestroy() {
    this.appScroller.disableScrolling = false;
  }

  membersCardsLoaded(): void {
    this.scrollHandler.setupListeners(API_TAB_CLASS_NAME);
  }
}
