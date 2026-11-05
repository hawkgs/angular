/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {MessageBus} from '../../../../protocol';
import {RemoteSignal} from './types';
import {signalRequestTopic, signalResponseTopic} from './utils';

export function remoteSignal<T>(name: string, initialValue: T): RemoteSignal<T> {
  // if (name) {
  //   throw new AngularDevtoolsError(`A remote signal with the name "${name}" already exists.`);
  // }
  // this.registered.add(name);

  let value: T = initialValue;
  let messageBus: MessageBus<any> | undefined;

  const signal = () => value;
  const responseTopic = signalResponseTopic(name);

  signal.__NG_REMOTE_SIGNAL = true;
  signal.__name = name;

  signal.set = (newValue: T) => {
    if (!messageBus) {
      throw new Error('DevTools: Not patched');
    }
    value = newValue;
    messageBus?.emit(responseTopic, [value]);
  };

  signal.update = (updater: Parameters<RemoteSignal<T>['update']>[0]) => {
    if (!messageBus) {
      throw new Error('DevTools: Not patched');
    }
    value = updater(value);
    messageBus?.emit(responseTopic, [value]);
  };

  signal.__patch = (bus: MessageBus<any>, registry: Set<string>) => {
    messageBus = bus;

    // This will be leaking
    messageBus.on(signalRequestTopic(name), () => {
      messageBus!.emit(responseTopic, [value]);
    });
  };

  signal.__patched = () => !!messageBus;

  return signal;
}
