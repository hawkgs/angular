/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {Fragment, h} from 'preact';
import {DocEntryRenderable} from '../entities/renderables';
import {normalizeSectionUrl} from '../transforms/url-transforms';
import {RawHtml} from './raw-html';

const USAGE_NOTES_SECTION_NAME = 'Usage Notes';

/** Component to render the usage notes section. */
export function SectionUsageNotes(props: {entry: DocEntryRenderable}) {
  if (!props.entry.htmlUsageNotes) {
    return <></>;
  }

  return (
    <div
      data-section={USAGE_NOTES_SECTION_NAME}
      data-section-url={normalizeSectionUrl(USAGE_NOTES_SECTION_NAME)}
    >
      <h3>{USAGE_NOTES_SECTION_NAME}</h3>
      <hr />
      <RawHtml value={props.entry.htmlUsageNotes} />
    </div>
  );
}
