/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {MessageBus} from '../../../../protocol';
import {RemoteSignal} from './types';
import {requestTopic, responseTopic} from './utils';

export function remoteSignal<T>(name: string, initialValue: T): RemoteSignal<T> {
  let value: T = initialValue;
  let messageBus: MessageBus<any> | undefined;
  let cleanUpFn: (() => void) | undefined;

  const signal = () => value;
  const responseTopicStr = responseTopic(name);

  signal.__NG_REMOTE_SIGNAL = true;
  signal.__name = name;

  signal.set = (newValue: T) => {
    if (!messageBus) {
      throw new Error('DevTools: Not patched');
    }
    value = newValue;
    messageBus?.emit(responseTopicStr, [value]);
  };

  signal.update = (updater: Parameters<RemoteSignal<T>['update']>[0]) => {
    if (!messageBus) {
      throw new Error('DevTools: Not patched');
    }
    value = updater(value);
    messageBus?.emit(responseTopicStr, [value]);
  };

  signal.dispose = () => {
    cleanUpFn?.();
  };

  signal.__patch = (bus: MessageBus<any>) => {
    messageBus = bus;

    cleanUpFn = messageBus.on(requestTopic(name), () => {
      messageBus!.emit(responseTopicStr, [value]);
    });
  };

  signal.__patched = () => !!messageBus;

  return signal;
}
