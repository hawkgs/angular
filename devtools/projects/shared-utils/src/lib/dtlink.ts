/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {MessageBus} from '../../../protocol';

export type DtLinkApi = Record<string, (...args: any[]) => Promise<unknown>>;

const requestTopic = (name: string) => `dtlink#${name}_request`;
const responseTopic = (name: string) => `dtlink#${name}_response`;

export class DtLink<T extends DtLinkApi = any> {
  private cleanUpFns: (() => void)[] = [];

  constructor(private messageBus: MessageBus<any>) {}

  call: T = new Proxy({} as T, {
    get: (_, prop) => {
      return (...args: any[]) =>
        new Promise((resolve) => {
          if (typeof prop === 'symbol') {
            return;
          }

          // If response exists START
          this.messageBus.once(responseTopic(prop), (response: any) => {
            resolve(response);
          });
          // If response exists END

          this.messageBus.emit(requestTopic(prop), args);
        });
    },
  });

  expose(api: DtLinkApi) {
    for (const [name, fn] of Object.entries(api)) {
      const cleanUp = this.messageBus.on(requestTopic(name), async (...args: any[]) => {
        const resp = await fn(...args);
        if (resp !== undefined) {
          this.messageBus.emit(responseTopic(name), [resp]);
        }
      });

      this.cleanUpFns.push(cleanUp);
    }
  }

  destroy() {
    for (const cleanUp of this.cleanUpFns) {
      cleanUp();
    }
    this.cleanUpFns = [];
  }
}
