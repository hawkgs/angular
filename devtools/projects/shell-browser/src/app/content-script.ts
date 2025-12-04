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
let backendInstalled = false;
let backendInitialized = false;

const port = chrome.runtime.connect({
  name: `${document.title || location.href}`,
});

const handleDisconnect = (): void => {
  // console.log('Background disconnected', new Date());
  localMessageBus.emit('shutdown');
  localMessageBus.destroy();
  chromeMessageBus.destroy();
  backgroundDisconnected = true;
};

port.onDisconnect.addListener(handleDisconnect);

const detectAngularMessageBus = new SamePageMessageBus(
  CONTENT_SCRIPT_URI,
  DETECT_ANGULAR_SCRIPT_URI,
);
const syncedLogger = new SyncedLogger(SyncedLoggerSrc.ContentScript).addChannel(
  detectAngularMessageBus,
);

syncedLogger.log('Init');

detectAngularMessageBus.on('detectAngular', (detectionResult) => {
  syncedLogger.log('"detectAngular" message intercepted');

  // only install backend once
  if (backendInstalled) {
    syncedLogger.log('"detectAngular" fail; Reason: backend not installed');
    return;
  }

  if (detectionResult.isAngularDevTools !== true) {
    syncedLogger.log('"detectAngular" fail; Reason: not Angular DevTools');
    return;
  }

  if (detectionResult.isAngular !== true) {
    syncedLogger.log('"detectAngular" fail; Reason: not an Angular app');
    return;
  }

  // Defensive check against non html page. Realistically this should never happen.
  if (document.contentType !== 'text/html') {
    syncedLogger.log('"detectAngular" fail; Reason: not an HTML page');
    return;
  }

  // Inform the background page so it can toggle the popup and icon.
  void chrome.runtime.sendMessage(detectionResult);

  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('app/backend_bundle.js');
  document.documentElement.appendChild(script);
  document.documentElement.removeChild(script);
  backendInstalled = true;

  syncedLogger.log('"detectAngular" success; Backend installed');
});

const localMessageBus = new SamePageMessageBus(CONTENT_SCRIPT_URI, BACKEND_URI);
const chromeMessageBus = new ChromeMessageBus(port);

syncedLogger.addChannel(localMessageBus).addChannel(chromeMessageBus);

const handshakeWithBackend = (): void => {
  syncedLogger.log('Emitting handshake with backend');
  localMessageBus.emit('handshake');
};

chromeMessageBus.onAny((topic, args) => {
  localMessageBus.emit(topic, args);
});

localMessageBus.onAny((topic, args) => {
  backendInitialized = true;
  chromeMessageBus.emit(topic, args);
});

if (!backendInitialized) {
  // tslint:disable-next-line:no-console
  console.log('Attempting initialization', new Date());
  syncedLogger.log('Attempting initialization');

  const retry = () => {
    if (backendInitialized || backgroundDisconnected) {
      return;
    }
    handshakeWithBackend();
    setTimeout(retry, 500);
  };
  retry();
}

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
