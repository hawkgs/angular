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

// If the BG disconnects, the FE won't be able to consume the accumulated
// logs in the logger. Therefore, it's exported as a global variable for these cases.
(globalThis as any).__DEV_SYNCED_LOGGER = syncedLogger;

port.onDisconnect.addListener(() => {
  syncedLogger.log(`Emitting 'shutdown'; Background disconnected`);
  localMessageBus.emit('shutdown');
  localMessageBus.destroy();
  chromeMessageBus.destroy();
  backgroundDisconnected = true;
});

function handshakeWithBackend() {
  syncedLogger.log(`Emitting 'handshake'; Attempting a handshake with backend`);
  localMessageBus.emit('handshake');
}

function attemptBackendHandshake() {
  if (!backendInitialized) {
    // tslint:disable-next-line:no-console
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

const detectAngularMessageBus = new SamePageMessageBus(
  CONTENT_SCRIPT_URI,
  DETECT_ANGULAR_SCRIPT_URI,
);

syncedLogger.addChannel(detectAngularMessageBus);
syncedLogger.log('Init');

// The message buses communicate in the following setting:
// ┌───────────┐   ┌──────────┐   ┌──────────┐
// │ detectNg  ├───┤ content  ├───┤ frontend │
// └───────────┘   │ script   │   └──────────┘
//                 └─────┬────┘
//                       │
//                 ┌─────┴────┐
//                 │ backend  │
//                 └──────────┘
// Where the the communication between the FE and BE
// is technically relayed through the Content script
// (no direct message bus).
//
// However, if we end up in a situation where the backend
// is not installed and initialized, the FE-BE message
// relaying will fail to notify the FE for any log messages
// accumulated in the `SyncedLogger`. This is why, in such
// cases, we resort to a fallback message relaying between
// Detect Angular and FE, until the BE is installed.
// This is the role of `BackendState`.
class BackendState {
  static fallbackRelayUnlisteners: (() => void)[] = [];

  static set(state: 'failed' | 'installed' | 'na') {
    switch (state) {
      case 'failed':
        if (!BackendState.fallbackRelayUnlisteners.length) {
          syncedLogger.log(
            `Backend installation failed. Establishing a temporary fallback relay between 'detect_ng' and 'fe'`,
          );
          BackendState.fallbackRelayUnlisteners.push(
            chromeMessageBus.onAny((topic, args) => {
              detectAngularMessageBus.emit(topic, args);
            }),
            detectAngularMessageBus.onAny((topic, args) => {
              chromeMessageBus.emit(topic, args);
            }),
          );
        }
        break;
      case 'installed':
        if (BackendState.fallbackRelayUnlisteners.length) {
          syncedLogger.log(
            `Backend installed. Destroying the temporary fallback relay between 'detect_ng' and 'fe'`,
          );
          for (const fn of BackendState.fallbackRelayUnlisteners) {
            fn();
          }
          BackendState.fallbackRelayUnlisteners = [];
        }
        break;
    }
  }
}

detectAngularMessageBus.on('detectAngular', (detectionResult) => {
  syncedLogger.log(`'detectAngular' message intercepted. Attempting backend installation.`);

  if (detectionResult.isAngularDevTools !== true) {
    syncedLogger.log(`'detectAngular' failed; Reason: not Angular DevTools`);
    BackendState.set('failed');
    return;
  }

  if (detectionResult.isAngular !== true) {
    syncedLogger.log(`'detectAngular' failed; Reason: not an Angular app`);
    BackendState.set('failed');
    return;
  }

  // Defensive check against non html page. Realistically this should never happen.
  if (document.contentType !== 'text/html') {
    syncedLogger.log(`'detectAngular' failed; Reason: not an HTML page`);
    BackendState.set('failed');
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
  BackendState.set('installed');

  attemptBackendHandshake();
});

const localMessageBus = new SamePageMessageBus(CONTENT_SCRIPT_URI, BACKEND_URI);
const chromeMessageBus = new ChromeMessageBus(port);

chromeMessageBus.emit('contentScriptInitialized');
syncedLogger.log(`Emitting 'contentScriptInitialized'`);

syncedLogger.addChannel(localMessageBus).addChannel(chromeMessageBus);

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
        syncedLogger.log('Extension context invalidated. Disconnecting content script');
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
