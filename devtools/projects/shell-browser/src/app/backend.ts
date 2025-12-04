/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {initializeMessageBus} from '../../../ng-devtools-backend';

import {unHighlight} from '../../../ng-devtools-backend/src/lib/highlighter';
import {SyncedLogger, SyncedLoggerSrc} from '../../../shared-utils';

import {initializeExtendedWindowOperations} from './chrome-window-extensions';
import {BACKEND_URI, CONTENT_SCRIPT_URI} from './communication';
import {SamePageMessageBus} from './same-page-message-bus';

const messageBus = new SamePageMessageBus(BACKEND_URI, CONTENT_SCRIPT_URI);
const syncedLogger = new SyncedLogger(SyncedLoggerSrc.Backend).addChannel(messageBus);
syncedLogger.log('Init');

let initialized = false;
messageBus.on('handshake', () => {
  syncedLogger.log(`'handshake' intercepted`);

  if (initialized) {
    return;
  }
  initialized = true;
  initializeMessageBus(messageBus, syncedLogger);
  initializeExtendedWindowOperations();

  let inspectorRunning = false;
  messageBus.on('inspectorStart', () => {
    inspectorRunning = true;
  });

  messageBus.on('inspectorEnd', () => {
    inspectorRunning = false;
  });

  // handles case when mouse leaves chrome extension too quickly. unHighlight() is not a very
  // expensive function and has an if check so it's DOM api call is not called more than necessary
  document.addEventListener(
    'mousemove',
    () => {
      if (!inspectorRunning) {
        unHighlight();
      }
    },
    false,
  );

  syncedLogger.log(`Emitting 'backendReady'; Backend initialized`);
  messageBus.emit('backendReady');
});
