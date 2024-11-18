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
import {normalizeSectionUrl} from '../transforms/url-transforms';
import {CodeTableOfContents} from './code-table-of-contents';

const API_SECTION_NAME = 'API';

/** Component to render the API section. */
export function SectionApi(props: {entry: DocEntryRenderable & HasRenderableToc}) {
  return (
    <div data-section={API_SECTION_NAME} data-section-url={normalizeSectionUrl(API_SECTION_NAME)}>
      <h3>{API_SECTION_NAME}</h3>
      <hr />
      <div class={'docs-reference-api-section'}>
        <CodeTableOfContents entry={props.entry} />
      </div>
    </div>
  );
}
