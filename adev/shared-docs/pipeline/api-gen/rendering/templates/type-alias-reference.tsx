/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {h} from 'preact';
import {TypeAliasEntryRenderable} from '../entities/renderables';
import {HeaderApi} from './header-api';
import {SectionDescription} from './section-description';
import {SectionUsageNotes} from './section-usage-notes';
import {SectionApi} from './section-api';

/** Component to render a type alias API reference document. */
export function TypeAliasReference(entry: TypeAliasEntryRenderable) {
  return (
    <div class="api">
      <HeaderApi entry={entry} />
      <SectionApi entry={entry} />
      <SectionDescription entry={entry} />
      <SectionUsageNotes entry={entry} />
    </div>
  );
}
