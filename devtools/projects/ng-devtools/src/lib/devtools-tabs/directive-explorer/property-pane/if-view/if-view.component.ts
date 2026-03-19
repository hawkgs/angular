import {ChangeDetectionStrategy, Component, input} from '@angular/core';
import {MatToolbar} from '@angular/material/toolbar';
import {IfBlock} from '../../../../../../../protocol';

@Component({
  selector: 'ng-if-view',
  templateUrl: './if-view.component.html',
  styleUrls: ['./if-view.component.scss', '../styles/view-tab.scss'],
  imports: [MatToolbar],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IfViewComponent {
  protected readonly if = input.required<IfBlock>();
}
