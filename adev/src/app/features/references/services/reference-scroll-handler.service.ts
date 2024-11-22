/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {DOCUMENT, isPlatformBrowser} from '@angular/common';
import {DestroyRef, Injectable, PLATFORM_ID, inject} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {fromEvent} from 'rxjs';
import {
  API_REFERENCE_MEMBER_CARD_CLASS_NAME,
  MEMBER_ID_ATTRIBUTE,
} from '../constants/api-reference-prerender.constants';
import {Router} from '@angular/router';

@Injectable()
export class ReferenceScrollHandler {
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  setupListeners(tocSelector: string): void {
    if (!this.isBrowser) {
      return;
    }

    this.setupCodeToCListeners(tocSelector);
    this.setupMemberCardListeners();
  }

  private setupCodeToCListeners(tocSelector: string): void {
    const tocContainer = this.document.querySelector<HTMLDivElement>(`.${tocSelector}`);

    if (!tocContainer) {
      return;
    }

    fromEvent(tocContainer, 'click')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        if (event.target instanceof HTMLAnchorElement) {
          event.stopPropagation();
          return;
        }

        // Get the card member ID from the attributes
        const target =
          event.target instanceof HTMLButtonElement
            ? event.target
            : this.findButtonElement(event.target as HTMLElement);
        const memberId = this.getMemberId(target);

        if (memberId) {
          this.router.navigate([], {fragment: memberId, replaceUrl: true});
        }
      });
  }

  private setupMemberCardListeners(): void {
    this.getAllMemberCards().forEach((card) => {
      const header = card.querySelector('header');

      if (!header) {
        return;
      }
      fromEvent(header, 'click')
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((event) => {
          const target = event.target as HTMLElement;
          if (target instanceof HTMLAnchorElement) {
            return;
          }

          this.router.navigate([], {fragment: header.id, replaceUrl: true});
        });
    });
  }

  private getAllMemberCards(): NodeListOf<HTMLDivElement> {
    return this.document.querySelectorAll<HTMLDivElement>(
      `.${API_REFERENCE_MEMBER_CARD_CLASS_NAME}`,
    );
  }

  private getMemberId(lineButton: HTMLButtonElement | null): string | undefined {
    if (!lineButton) {
      return undefined;
    }
    return lineButton.attributes.getNamedItem(MEMBER_ID_ATTRIBUTE)?.value;
  }

  private findButtonElement(element: HTMLElement) {
    let parent = element.parentElement;

    while (parent) {
      if (parent instanceof HTMLButtonElement) {
        return parent;
      }

      parent = parent.parentElement;
    }

    return null;
  }
}
