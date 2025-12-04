/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

/// <reference types="chrome"/>

import {DevToolsConnection, TabManager, Tabs} from './tab_manager';

interface MockSender {
  url: string;
  tab: {
    id: number;
  };
  frameId: number;
}

const TEST_MESSAGE_ONE = {topic: 'test', args: ['test1']};
const TEST_MESSAGE_TWO = {topic: 'test', args: ['test2']};

class MockPort {
  onMessageListeners: Function[] = [];
  onDisconnectListeners: Function[] = [];
  messagesPosted: any[] = [];
  name: string;
  sender?: MockSender;

  constructor(
    public properties: {
      name: string;
      sender?: MockSender;
    },
  ) {
    this.name = properties.name;
    this.sender = properties.sender;
  }

  postMessage(message: any): void {
    this.messagesPosted.push(message);
  }

  onMessage = {
    addListener: (listener: Function): void => {
      this.onMessageListeners.push(listener);
    },
    removeListener: (listener: Function) => {
      this.onMessageListeners = this.onMessageListeners.filter((l) => l !== listener);
    },
  };

  onDisconnect = {
    addListener: (listener: Function): void => {
      this.onDisconnectListeners.push(listener);
    },
  };
}

function assertArrayHasObj<T>(array: T[], obj: T) {
  expect(array).toContain(jasmine.objectContaining(obj as object));
}

function assertArrayDoesNotHaveObj<T extends object>(array: T[], obj: T) {
  expect(array).not.toContain(jasmine.objectContaining(obj));
}

function mockSpyFunction(obj: any, property: string, returnValue: any) {
  (obj[property] as any).and.returnValue(() => returnValue);
}

function mockSpyProperty(obj: any, property: string, value: any) {
  (Object.getOwnPropertyDescriptor(obj, property)!.get as any).and.returnValue(value);
}

describe('Tab Manager - ', () => {
  let tabs: Tabs;
  const tabId = 12345;
  let chromeRuntime: jasmine.SpyObj<typeof chrome.runtime>;
  let tabManager: TabManager;
  let tab: DevToolsConnection;
  let chromeRuntimeOnConnectListeners: ((port: MockPort) => void)[] = [];

  function connectToChromeRuntime(port: MockPort): void {
    for (const listener of chromeRuntimeOnConnectListeners) {
      listener(port);
    }
  }

  function emitMessageToPort(port: MockPort, message: any): void {
    for (const listener of port.onMessageListeners) {
      listener(message);
    }
  }

  function emitContentScriptInitToPort(contentScriptPort: MockPort) {
    emitMessageToPort(contentScriptPort, {topic: 'contentScriptInitialized'});
  }

  function emitDisconnectToPort(port: MockPort) {
    for (const listener of port.onDisconnectListeners) {
      listener();
    }
  }

  function createDevToolsPort() {
    const port = new MockPort({
      name: tabId.toString(),
    });
    connectToChromeRuntime(port);
    return port;
  }

  beforeEach(() => {
    chromeRuntimeOnConnectListeners = [];
    chromeRuntime = jasmine.createSpyObj(
      'chrome.runtime',
      ['getManifest', 'getURL'],
      ['onConnect', 'onDisconnect'],
    );
    mockSpyFunction(chromeRuntime, 'getManifest', {manifest_version: 3});
    mockSpyFunction(chromeRuntime, 'getURL', (path: string) => path);
    mockSpyProperty(chromeRuntime, 'onConnect', {
      addListener: (listener: (port: MockPort) => void) => {
        chromeRuntimeOnConnectListeners.push(listener);
      },
    });
  });

  describe('Single Frame', () => {
    const testURL = 'http://example.com';
    const contentScriptFrameId = 0;

    function createContentScriptPort() {
      const port = new MockPort({
        name: 'Content Script',
        sender: {
          url: testURL,
          tab: {
            id: tabId,
          },
          frameId: contentScriptFrameId,
        },
      });
      connectToChromeRuntime(port);
      return port;
    }

    beforeEach(() => {
      tabs = {};
      tabManager = TabManager.initialize(tabs, chromeRuntime);
    });

    async function* eachOrderingOfDevToolsInitialization(): AsyncGenerator<{
      tab: DevToolsConnection;
      contentScriptPort: MockPort;
      devtoolsPort: MockPort;
    }> {
      {
        // Content Script -> Backend Ready -> Devtools
        const contentScriptPort = createContentScriptPort();
        emitContentScriptInitToPort(contentScriptPort);
        const devtoolsPort = createDevToolsPort();
        const tab = tabs[tabId]!;
        await tab.contentScripts[contentScriptFrameId].contentScriptInit;
        yield {tab, contentScriptPort, devtoolsPort};
        delete tabs[tabId];
      }

      {
        // Content Script -> Devtools -> Backend Ready
        const contentScriptPort = createContentScriptPort();
        const devtoolsPort = createDevToolsPort();
        emitContentScriptInitToPort(contentScriptPort);
        const tab = tabs[tabId]!;
        await tab.contentScripts[contentScriptFrameId].contentScriptInit;
        yield {tab, contentScriptPort, devtoolsPort};
        delete tabs[tabId];
      }

      {
        // Devtools -> Content Script -> Backend Ready
        const devtoolsPort = createDevToolsPort();
        const contentScriptPort = createContentScriptPort();
        emitContentScriptInitToPort(contentScriptPort);
        const tab = tabs[tabId]!;
        await tab.contentScripts[contentScriptFrameId].contentScriptInit;
        yield {tab, contentScriptPort, devtoolsPort};
      }
    }

    it('should setup tab object in the tab manager', async () => {
      for await (const {
        tab,
        contentScriptPort,
        devtoolsPort,
      } of eachOrderingOfDevToolsInitialization()) {
        expect(tab).toBeDefined();
        expect(tab!.devtools).toBe(devtoolsPort as unknown as chrome.runtime.Port);
        expect(tab!.contentScripts[contentScriptFrameId].port).toBe(
          contentScriptPort as unknown as chrome.runtime.Port,
        );
      }
    });

    it('should set frame connection as enabled when an enableFrameConnection message is recieved', async () => {
      for await (const {tab, devtoolsPort} of eachOrderingOfDevToolsInitialization()) {
        expect(tab?.contentScripts[contentScriptFrameId]?.enabled).toBe(false);

        emitMessageToPort(devtoolsPort, {
          topic: 'enableFrameConnection',
          args: [contentScriptFrameId, tabId],
        });

        expect(tab?.contentScripts[contentScriptFrameId]?.enabled).toBe(true);
        assertArrayHasObj(devtoolsPort.messagesPosted, {
          topic: 'frameConnected',
          args: [contentScriptFrameId],
        });
      }
    });

    it('should pipe messages from the content script and devtools script to each other when the content script frame is enabled', async () => {
      for await (const {
        contentScriptPort,
        devtoolsPort,
      } of eachOrderingOfDevToolsInitialization()) {
        emitMessageToPort(devtoolsPort, {
          topic: 'enableFrameConnection',
          args: [contentScriptFrameId, tabId],
        });

        // Verify that the double pipe is set up between the content script and the devtools page.
        emitMessageToPort(contentScriptPort, TEST_MESSAGE_ONE);
        assertArrayHasObj(devtoolsPort.messagesPosted, TEST_MESSAGE_ONE);
        assertArrayDoesNotHaveObj(contentScriptPort.messagesPosted, TEST_MESSAGE_ONE);

        emitMessageToPort(devtoolsPort, TEST_MESSAGE_TWO);
        assertArrayHasObj(contentScriptPort.messagesPosted, TEST_MESSAGE_TWO);
        assertArrayDoesNotHaveObj(devtoolsPort.messagesPosted, TEST_MESSAGE_TWO);
      }
    });

    it('should not pipe messages from the content script and devtools script to each other when the content script frame is disabled', async () => {
      for await (const {
        tab,
        contentScriptPort,
        devtoolsPort,
      } of eachOrderingOfDevToolsInitialization()) {
        expect(tab?.contentScripts[contentScriptFrameId]?.enabled).toBe(false);

        emitMessageToPort(contentScriptPort, TEST_MESSAGE_ONE);
        assertArrayDoesNotHaveObj(contentScriptPort.messagesPosted, TEST_MESSAGE_ONE);

        emitMessageToPort(devtoolsPort, TEST_MESSAGE_TWO);
        assertArrayDoesNotHaveObj(devtoolsPort.messagesPosted, TEST_MESSAGE_TWO);
      }
    });

    it('should set contentScriptInitialized when the contentPort recieves the contentScriptInitialized message', async () => {
      for await (const {
        contentScriptPort,
        devtoolsPort,
      } of eachOrderingOfDevToolsInitialization()) {
        emitMessageToPort(devtoolsPort, {
          topic: 'enableFrameConnection',
          args: [contentScriptFrameId, tabId],
        });

        assertArrayHasObj(devtoolsPort.messagesPosted, {
          topic: 'contentScriptConnected',
          args: [contentScriptFrameId, contentScriptPort.name, contentScriptPort.sender!.url],
        });
      }
    });

    it('should set tab.devtools to null when the devtoolsPort disconnects', async () => {
      for await (const {tab, devtoolsPort} of eachOrderingOfDevToolsInitialization()) {
        emitMessageToPort(devtoolsPort, {
          topic: 'enableFrameConnection',
          args: [contentScriptFrameId, tabId],
        });
        expect(tab?.contentScripts[contentScriptFrameId]?.enabled).toBe(true);

        emitDisconnectToPort(devtoolsPort);
        expect(tab.devtools).toBeNull();
        expect(tab?.contentScripts[contentScriptFrameId]?.enabled).toBe(false);
      }
    });
  });

  describe('Multiple Frames', () => {
    const topLevelFrameId = 0;
    const childFrameId = 1;

    function createTopLevelContentScriptPort() {
      const port = new MockPort({
        name: 'Top level content script',
        sender: {
          url: 'TEST_URL',
          tab: {
            id: tabId,
          },
          frameId: topLevelFrameId,
        },
      });
      connectToChromeRuntime(port);
      return port;
    }
    function createChildContentScriptPort() {
      const port = new MockPort({
        name: 'Child content script',
        sender: {
          url: 'TEST_URL_2',
          tab: {
            id: tabId,
          },
          frameId: childFrameId,
        },
      });
      connectToChromeRuntime(port);
      return port;
    }

    async function* eachOrderingOfDevToolsInitialization() {
      {
        // Devtools Connected -> Top Level Content Script Connected -> Top Level Content Script Initialized
        // -> Child Content Script Connected -> Child Content Script Initialized
        const devtoolsPort = createDevToolsPort();
        const topLevelContentScriptPort = createTopLevelContentScriptPort();
        emitContentScriptInitToPort(topLevelContentScriptPort);
        const childContentScriptPort = createChildContentScriptPort();
        emitContentScriptInitToPort(childContentScriptPort);
        const tab = tabs[tabId]!;
        await tab.contentScripts[topLevelFrameId].contentScriptInit;
        await tab.contentScripts[childFrameId].contentScriptInit;
        yield {tab, topLevelContentScriptPort, childContentScriptPort, devtoolsPort};
        delete tabs[tabId];
      }

      {
        // Top Level Content Script Connected -> Top Level Content Script Initialized -> Devtools Connected
        // -> Child Content Script Connected -> Child Content Script Initialized
        const topLevelContentScriptPort = createTopLevelContentScriptPort();
        emitContentScriptInitToPort(topLevelContentScriptPort);
        const devtoolsPort = createDevToolsPort();
        const childContentScriptPort = createChildContentScriptPort();
        emitContentScriptInitToPort(childContentScriptPort);
        const tab = tabs[tabId]!;
        await tab.contentScripts[topLevelFrameId].contentScriptInit;
        await tab.contentScripts[childFrameId].contentScriptInit;
        yield {tab, topLevelContentScriptPort, childContentScriptPort, devtoolsPort};
        delete tabs[tabId];
      }

      {
        // Top Level Content Script Connected -> Top Level Content Script Initialized -> Child Content Script Connected
        // -> Child Content Script Initialized -> Devtools Connected
        const topLevelContentScriptPort = createTopLevelContentScriptPort();
        emitContentScriptInitToPort(topLevelContentScriptPort);
        const childContentScriptPort = createChildContentScriptPort();
        emitContentScriptInitToPort(childContentScriptPort);
        const devtoolsPort = createDevToolsPort();
        tab = tabs[tabId]!;
        await tab.contentScripts[topLevelFrameId].contentScriptInit;
        await tab.contentScripts[childFrameId].contentScriptInit;
        yield {tab, topLevelContentScriptPort, childContentScriptPort, devtoolsPort};
        delete tabs[tabId];
      }

      {
        // Top Level Content Script Connected -> Devtools Connected -> Child Content Script Connected
        // -> Top Level Content Script Initialized -> Child Content Script Initialized
        const topLevelContentScriptPort = createTopLevelContentScriptPort();
        const devtoolsPort = createDevToolsPort();
        const childContentScriptPort = createChildContentScriptPort();
        emitContentScriptInitToPort(topLevelContentScriptPort);
        emitContentScriptInitToPort(childContentScriptPort);
        const tab = tabs[tabId]!;
        await tab.contentScripts[topLevelFrameId].contentScriptInit;
        await tab.contentScripts[childFrameId].contentScriptInit;
        yield {tab, topLevelContentScriptPort, childContentScriptPort, devtoolsPort};
      }
    }

    beforeEach(() => {
      tabs = {};
      tabManager = TabManager.initialize(tabs, chromeRuntime);
    });

    it('should setup tab object in the tab manager', async () => {
      for await (const {
        tab,
        topLevelContentScriptPort,
        childContentScriptPort,
        devtoolsPort,
      } of eachOrderingOfDevToolsInitialization()) {
        expect(tab).toBeDefined();
        expect(tab!.devtools).toBe(devtoolsPort as unknown as chrome.runtime.Port);
        expect(tab!.contentScripts[topLevelFrameId].port).toBe(
          topLevelContentScriptPort as unknown as chrome.runtime.Port,
        );
        expect(tab!.contentScripts[childFrameId].port).toBe(
          childContentScriptPort as unknown as chrome.runtime.Port,
        );
      }
    });

    it('should setup message and disconnect listeners on devtools and content script ports', async () => {
      for await (const {
        topLevelContentScriptPort,
        childContentScriptPort,
        devtoolsPort,
      } of eachOrderingOfDevToolsInitialization()) {
        expect(topLevelContentScriptPort.onDisconnectListeners.length).toBeGreaterThan(0);
        expect(childContentScriptPort.onDisconnectListeners.length).toBeGreaterThan(0);
        expect(devtoolsPort.onDisconnectListeners.length).toBeGreaterThan(0);
        expect(topLevelContentScriptPort.onMessageListeners.length).toBeGreaterThan(0);
      }
    });

    it('should set the correct frame connection as enabled when an enableFrameConnection message is recieved', async () => {
      for await (const {tab, devtoolsPort} of eachOrderingOfDevToolsInitialization()) {
        expect(tab?.contentScripts[topLevelFrameId]?.enabled).toBe(false);
        expect(tab?.contentScripts[childFrameId]?.enabled).toBe(false);
        emitMessageToPort(devtoolsPort, {
          topic: 'enableFrameConnection',
          args: [topLevelFrameId, tabId],
        });
        expect(tab?.contentScripts[topLevelFrameId]?.enabled).toBe(true);
        expect(tab?.contentScripts[childFrameId]?.enabled).toBe(false);
        assertArrayHasObj(devtoolsPort.messagesPosted, {
          topic: 'frameConnected',
          args: [topLevelFrameId],
        });
        assertArrayDoesNotHaveObj(devtoolsPort.messagesPosted, {
          topic: 'frameConnected',
          args: [childFrameId],
        });
      }
    });

    it('should pipe messages from the correct content script and devtools script when that content script frame is enabled', async () => {
      for await (const {
        topLevelContentScriptPort,
        childContentScriptPort,
        devtoolsPort,
      } of eachOrderingOfDevToolsInitialization()) {
        emitMessageToPort(devtoolsPort, {
          topic: 'enableFrameConnection',
          args: [topLevelFrameId, tabId],
        });
        emitMessageToPort(devtoolsPort, TEST_MESSAGE_ONE);
        assertArrayHasObj(topLevelContentScriptPort.messagesPosted, TEST_MESSAGE_ONE);
        assertArrayDoesNotHaveObj(childContentScriptPort.messagesPosted, TEST_MESSAGE_ONE);

        emitMessageToPort(devtoolsPort, {
          topic: 'enableFrameConnection',
          args: [childFrameId, tabId],
        });
        emitMessageToPort(devtoolsPort, TEST_MESSAGE_TWO);
        assertArrayHasObj(childContentScriptPort.messagesPosted, TEST_MESSAGE_TWO);
        assertArrayDoesNotHaveObj(topLevelContentScriptPort.messagesPosted, TEST_MESSAGE_TWO);
      }
    });
  });
});
