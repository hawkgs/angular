/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {Events, MessageBus} from '../../../protocol';
import {SyncedLogger} from '../../../shared-utils';

import {subscribeToClientEvents} from './client-event-subscribers';

export const initializeMessageBus = (
  messageBus: MessageBus<Events>,
  syncedLogger: SyncedLogger,
) => {
  syncedLogger.log(`'ng-devtools-backend' initialized`);
  subscribeToClientEvents(messageBus, syncedLogger);
};
