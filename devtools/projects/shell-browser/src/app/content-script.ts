/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

/// <reference types="chrome"/>

import {SyncedLogger, SyncedLoggerSrc} from '../../../shared-utils';
import {ChromeMessageBus} from './chrome-message-bus';
import {BACKEND_URI, CONTENT_SCRIPT_URI, DETECT_ANGULAR_SCRIPT_URI} from './communication';
import {SamePageMessageBus} from './same-page-message-bus';

let backgroundDisconnected = false;
let backendInitialized = false;

const port = chrome.runtime.connect({
  name: `${document.title || location.href}`,
});
const syncedLogger = new SyncedLogger(SyncedLoggerSrc.ContentScript);

const handleDisconnect = (): void => {
  syncedLogger.log(`Emitting 'shutdown'; Background disconnected`);
  localMessageBus.emit('shutdown');
  localMessageBus.destroy();
  chromeMessageBus.destroy();
  backgroundDisconnected = true;
};

function attemptBackendHandshake() {
  if (!backendInitialized) {
    console.log('Attempting handshake with backend', new Date());
    syncedLogger.log('Attempting backend handshake');

    const retry = () => {
      if (backendInitialized || backgroundDisconnected) {
        syncedLogger.log('Backend handshake aborted; Reason: BE initialized or BG disconnected', {
          backendInitialized,
          backgroundDisconnected,
        });
        return;
      }
      handshakeWithBackend();
      setTimeout(retry, 500);
    };
    retry();
  }
}

port.onDisconnect.addListener(handleDisconnect);

const detectAngularMessageBus = new SamePageMessageBus(
  CONTENT_SCRIPT_URI,
  DETECT_ANGULAR_SCRIPT_URI,
);
syncedLogger.addChannel(detectAngularMessageBus);

(globalThis as any).SYNCED_LOGGER = syncedLogger;

syncedLogger.log('Init');

detectAngularMessageBus.on('detectAngular', (detectionResult) => {
  syncedLogger.log(`'detectAngular' message intercepted`);

  if (detectionResult.isAngularDevTools !== true) {
    syncedLogger.log(`'detectAngular' failed; Reason: not Angular DevTools`);
    return;
  }

  if (detectionResult.isAngular !== true) {
    syncedLogger.log(`'detectAngular' failed; Reason: not an Angular app`);
    return;
  }

  // Defensive check against non html page. Realistically this should never happen.
  if (document.contentType !== 'text/html') {
    syncedLogger.log(`'detectAngular' failed; Reason: not an HTML page`);
    return;
  }

  // Inform the background page so it can toggle the popup and icon.
  void chrome.runtime.sendMessage(detectionResult);

  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('app/backend_bundle.js');
  document.documentElement.appendChild(script);
  document.documentElement.removeChild(script);

  syncedLogger.log(`'detectAngular' succeeded; Backend bundle installed`);
  detectAngularMessageBus.emit('backendInstalled');

  attemptBackendHandshake();
});

const localMessageBus = new SamePageMessageBus(CONTENT_SCRIPT_URI, BACKEND_URI);
const chromeMessageBus = new ChromeMessageBus(port);

syncedLogger.addChannel(localMessageBus).addChannel(chromeMessageBus);

const handshakeWithBackend = (): void => {
  syncedLogger.log(`Emitting 'handshake'; Attempting a handshake with backend`);
  localMessageBus.emit('handshake');
};

// Relaying messages from FE to BE
chromeMessageBus.onAny((topic, args) => {
  localMessageBus.emit(topic, args);
});

// Relaying messages from BE to FE
localMessageBus.onAny((topic, args) => {
  chromeMessageBus.emit(topic, args);
});

// Mark BE as initialized
localMessageBus.on('backendReady', () => {
  syncedLogger.log(`Intercepting 'backendReady'; Backend initialized`);
  backendInitialized = true;
});

const proxyEventFromWindowToDevToolsExtension = (event: MessageEvent) => {
  if (event.source === window && event.data && event.data.__NG_DEVTOOLS_EVENT__) {
    try {
      chrome.runtime.sendMessage(event.data);
    } catch (e) {
      const {message} = e as Error;
      if (message.includes('Extension context invalidated.')) {
        console.error(
          'Angular DevTools: Disconnecting content script due to invalid extension context. Please reload the page.',
        );
        window.removeEventListener('message', proxyEventFromWindowToDevToolsExtension);
      }
      throw e;
    }
  }
};

window.addEventListener('message', proxyEventFromWindowToDevToolsExtension);
