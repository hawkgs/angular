/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {h} from 'preact';
import {DocEntryRenderable} from '../entities/renderables';
import {HasRenderableToc} from '../entities/traits';
import {convertSectionNameToId} from '../transforms/reference-section-id';
import {CodeTableOfContents} from './code-table-of-contents';
import {SECTION_CONTAINER, SECTION_TITLE} from '../styling/css-classes';

const API_SECTION_NAME = 'API';

/** Component to render the API section. */
export function SectionApi(props: {entry: DocEntryRenderable & HasRenderableToc}) {
  return (
    <div
      className={SECTION_CONTAINER + ' docs-reference-api-section'}
      id={convertSectionNameToId(API_SECTION_NAME)}
    >
      <h3 className={SECTION_TITLE}>{API_SECTION_NAME}</h3>
      <CodeTableOfContents entry={props.entry} />
    </div>
  );
}
