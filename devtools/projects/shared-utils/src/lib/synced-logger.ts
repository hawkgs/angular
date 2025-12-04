/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {MessageBus} from '../../../protocol';

type SyncedLogPayload = Record<string, number | string | boolean | undefined | null>;

export enum SyncedLoggerSrc {
  ContentScript = 'content',
  DetectAngularScript = 'detect_ng',
  Backend = 'be',
  Frontend = 'fe',
}

export interface AppData {
  isAngular?: boolean;
  version?: string;
  isDevMode?: boolean;
  isIvy?: boolean;
}

export interface SyncedLog {
  location: string;
  text: string;
  payload?: SyncedLogPayload;
  createdAt: number;
}

const SYNC_REQUEST_MSG = '__SYNC_LOGGER_REQUEST_DATA';
const SYNC_APP_DATA_MSG = '__SYNC_LOGGER_SYNC_APP_DATA';
const SYNC_LOGS_MSG = '__SYNC_LOGGER_SYNC_LOGS';

export interface SyncedLoggerEvents {
  [SYNC_APP_DATA_MSG]: (data: AppData) => void;
  [SYNC_LOGS_MSG]: (logs: [string, SyncedLog][]) => void;
  [SYNC_REQUEST_MSG]: (messageId: string) => void;
}

/**
 * A logger that has a synchronized state among all instances.
 */
export class SyncedLogger {
  private appData?: AppData;
  private logs = new Map<string, SyncedLog>();
  private channels = new Set<MessageBus<SyncedLoggerEvents>>();

  constructor(private source: SyncedLoggerSrc) {}

  addChannel(messageBus: MessageBus<unknown>) {
    const bus = messageBus as MessageBus<SyncedLoggerEvents>;

    this.channels.add(bus);

    // Since message bus might not be unique to the logger instance,
    // use an ID to avoid self-serving logs and app data.
    const messageId = generateUUIDv4();

    // Request data from existing channels (i.e. new synced logger).
    bus.emit(SYNC_REQUEST_MSG, [messageId]);

    // Intercept synchornization requests of new synced loggers.
    bus.on(SYNC_REQUEST_MSG, (extMsgId) => {
      if (extMsgId !== messageId) {
        this.emitLogs();
        this.emitAppData();
      }
    });

    // Intercept logs updates
    bus.on(SYNC_LOGS_MSG, (extLogs) => {
      for (const [id, log] of extLogs) {
        this.logs.set(id, log);
      }

      // Propagate to other channels excl. the source channel.
      const channelsWithoutSrc = Array.from(this.channels).filter((b) => b !== bus);
      this.emitLogs(channelsWithoutSrc);
    });

    // Intercept app data updates
    bus.on(SYNC_APP_DATA_MSG, (extAppData) => {
      this.appData = {
        ...this.appData,
        ...extAppData,
      };

      // Propagate to other channels excl. the source channel.
      const channelsWithoutSrc = Array.from(this.channels).filter((b) => b !== bus);
      this.emitAppData(channelsWithoutSrc);
    });

    return this;
  }

  setAppData(appData: AppData) {
    this.appData = {
      ...this.appData,
      ...appData,
    };

    this.emitAppData();
  }

  log(text: string, payload?: SyncedLogPayload) {
    this.logs.set(generateUUIDv4(), {
      location: this.source,
      text,
      createdAt: new Date().getTime(),
      ...(payload ? {payload} : {}),
    });

    this.emitLogs();
  }

  getFullLog() {
    const logs = Array.from(this.logs)
      .sort(([, a], [, b]) => a.createdAt - b.createdAt)
      .map(([, log]) => ({
        ...log,
        createdAt: new Date(log.createdAt).toISOString(),
      }));

    return {
      appData: this.appData,
      logs,
    };
  }

  exportFullLog() {
    const downloadLink = document.createElement('a');
    downloadLink.download = `ng-devtools-logs.json`;
    downloadLink.href = URL.createObjectURL(
      new Blob([JSON.stringify(this.getFullLog(), null, 2)], {type: 'application/json'}),
    );
    downloadLink.click();

    setTimeout(() => URL.revokeObjectURL(downloadLink.href));
  }

  // Notify for app data changes
  private emitAppData(
    channels: MessageBus<SyncedLoggerEvents>[] | Set<MessageBus<SyncedLoggerEvents>> = this
      .channels,
  ) {
    for (const bus of channels) {
      bus.emit(SYNC_APP_DATA_MSG, [this.appData || {}]);
    }
  }

  // Notify for logs changes
  private emitLogs(
    channels: MessageBus<SyncedLoggerEvents>[] | Set<MessageBus<SyncedLoggerEvents>> = this
      .channels,
  ) {
    for (const bus of channels) {
      bus.emit(SYNC_LOGS_MSG, [Array.from(this.logs)]);
    }
  }
}

// Note: Gemini-generated
function generateUUIDv4(): string {
  const b = new Uint8Array(16);
  globalThis.crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;

  return Array.from(b, (x) => x.toString(16).padStart(2, '0'))
    .join('')
    .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
}
