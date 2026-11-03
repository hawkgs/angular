/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {MessageBus} from '../../../protocol';

export type DtLinkApi = Record<
  string,
  (...args: any[]) => Promise<unknown> | AsyncGenerator<unknown>
>;

const requestTopic = (name: string) => `dtlink#${name}_request`;
const responseTopic = (name: string) => `dtlink#${name}_response`;
const isGeneratorFn = (name: string) => name.endsWith('$');
const shouldFnReturn = (name: string) => name.startsWith('get') || name.startsWith('request');

type GeneratorResponse = {d: boolean; v?: any};

export class DtLink<T extends DtLinkApi = any> {
  private cleanUpFns: (() => void)[] = [];

  constructor(private messageBus: MessageBus<any>) {}

  call: T = new Proxy({} as T, {
    get: (_, prop) => {
      return (...args: any[]) => {
        if (typeof prop === 'symbol') {
          return;
        }

        if (isGeneratorFn(prop)) {
          const that = this;

          return (async function* () {
            const queue: any[] = [];
            let wake: (() => void) | null = null;
            let done = false;

            const cleanUp = that.messageBus.on(responseTopic(prop), ({d, v}: GeneratorResponse) => {
              queue.push(v);
              done = d;
              wake?.();
            });
            that.messageBus.emit(requestTopic(prop), args);

            while (!done) {
              while (queue.length) {
                yield queue.shift();
              }
              await new Promise<void>((res) => (wake = res));
              wake = null;
            }
            cleanUp();
          })();
        }

        const shouldReturn = shouldFnReturn(prop);

        return new Promise((resolve) => {
          if (shouldReturn) {
            this.messageBus.once(responseTopic(prop), resolve);
          }

          this.messageBus.emit(requestTopic(prop), args);
        });
      };
    },
  });

  expose(api: DtLinkApi) {
    for (const [name, fn] of Object.entries(api)) {
      const cleanUp = this.messageBus.on(requestTopic(name), async (...args: any[]) => {
        if (isGeneratorFn(name)) {
          const generator = fn(...args) as AsyncGenerator;
          for await (const value of generator) {
            this.messageBus.emit(responseTopic(name), [
              {d: false, v: value} satisfies GeneratorResponse,
            ]);
          }
          this.messageBus.emit(responseTopic(name), [{d: true} satisfies GeneratorResponse]);
        } else {
          const resp = await fn(...args);
          if (resp !== undefined) {
            this.messageBus.emit(responseTopic(name), [resp]);
          }
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
