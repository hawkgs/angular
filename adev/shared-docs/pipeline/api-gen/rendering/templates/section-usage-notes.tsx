/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {Fragment, h} from 'preact';
import {DocEntryRenderable} from '../entities/renderables';
import {convertSectionNameToId} from '../transforms/reference-section-id';
import {RawHtml} from './raw-html';
import {SECTION_CONTAINER, SECTION_TITLE} from '../styling/css-classes';

const USAGE_NOTES_SECTION_NAME = 'Usage Notes';

/** Component to render the usage notes section. */
export function SectionUsageNotes(props: {entry: DocEntryRenderable}) {
  if (!props.entry.htmlUsageNotes) {
    return <></>;
  }

  return (
    <div className={SECTION_CONTAINER} id={convertSectionNameToId(USAGE_NOTES_SECTION_NAME)}>
      <h3 className={SECTION_TITLE}>{USAGE_NOTES_SECTION_NAME}</h3>
      <RawHtml value={props.entry.htmlUsageNotes} />
    </div>
  );
}
