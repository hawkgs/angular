/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {MessageBus} from '../../../../protocol';
import {RemoteSignal, RemoteSignalInternal} from './types';
import {
  DTLINK_DISPOSE_SIGNALS,
  dtlinkRequestTopic,
  dtlinkResponseTopic,
  remoteSignalName,
} from './utils';

/**
 * Creates a `RemoteSignal` on the source.
 *
 * NOTE: The developer MUST dispose it manually when
 * no longer needed via `.dispose()`.
 */
export function remoteSignal<T>(name: string, initialValue: T): RemoteSignal<T> {
  let value: T = initialValue;
  let messageBus: MessageBus<any> | undefined;
  let cleanUpFn: (() => void) | undefined;

  const signal = () => value;
  const prefixedName = remoteSignalName(name);
  const responseTopic = dtlinkResponseTopic(prefixedName);
  const requestTopic = dtlinkRequestTopic(prefixedName);

  signal.__NG_DTLINK_REMOTE_SIGNAL = true as const;

  signal.set = (newValue: T) => {
    if (!messageBus) {
      // TBD: Use AngularDevtoolsError
      throw new Error(
        `AngularDevtoolsError: Cannot set. Remote signal "${name}" is not exposed to the DtLink API.`,
      );
    }
    value = newValue;
    messageBus?.emit(responseTopic, [value]);
  };

  signal.update = (updater: Parameters<RemoteSignal<T>['update']>[0]) => {
    if (!messageBus) {
      // TBD: Use AngularDevtoolsError
      throw new Error(
        `AngularDevtoolsError: Cannot update. Remote signal "${name}" is not exposed to the DtLink API.`,
      );
    }
    value = updater(value);
    messageBus?.emit(responseTopic, [value]);
  };

  signal.dispose = () => cleanUpFn?.();

  signal.__patch = (bus: MessageBus<any>) => {
    messageBus = bus;

    cleanUpFn = messageBus.on(requestTopic, () => {
      messageBus!.emit(responseTopic, [value]);
    });
    messageBus.once(DTLINK_DISPOSE_SIGNALS, () => signal.dispose());
  };

  return signal satisfies RemoteSignalInternal<T>;
}
