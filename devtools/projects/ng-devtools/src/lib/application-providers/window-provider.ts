import {InjectionToken, Provider} from '@angular/core';

export const WINDOW = new InjectionToken<Window>('WINDOW');

export const provideWindow = (): Provider => ({
  provide: WINDOW,
  useValue: window,
});
