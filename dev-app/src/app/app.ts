import {Component, signal} from '@angular/core';
import {RouterOutlet} from '@angular/router';

@Component({
  selector: 'app-foo',
  template: 'FOO',
})
export class Foo {
  constructor() {
    throw new Error('BOOM');
  }
}

@Component({
  selector: 'app-bar',
  template: 'BAR',
})
export class Bar {}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Foo, Bar],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly title = signal('dev-app');
}
