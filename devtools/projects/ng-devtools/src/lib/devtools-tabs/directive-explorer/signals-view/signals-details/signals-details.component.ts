/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {ChangeDetectionStrategy, Component, computed, inject, input, output} from '@angular/core';
import {DataSource} from '@angular/cdk/collections';
import {FlatTreeControl} from '@angular/cdk/tree';
import {MatIcon} from '@angular/material/icon';
import {MatTreeFlattener} from '@angular/material/tree';

import {DebugSignalGraphNode, MessageBus, PropType} from '../../../../../../../protocol';
import {
  FlatNode,
  SignalsValueTreeComponent,
  Property,
} from './signals-value-tree/signals-value-tree.component';
import {ButtonComponent} from '../../../../shared/button/button.component';
import {
  isGroupNode,
  isSignalNode,
  DevtoolsSignalGraphNode,
  SignalGraphManager,
  checkResourceGroupMatch,
} from '../../signal-graph';
import {arrayifyProps, SignalDataSource} from './signal-data-source';

const TYPE_CLASS_MAP: {[key in DebugSignalGraphNode['kind'] & 'resource']: string} = {
  'signal': 'type-signal',
  'computed': 'type-computed',
  'effect': 'type-effect',
  'afterRenderEffectPhase': 'type-effect',
  'template': 'type-template',
  'linkedSignal': 'type-linked-signal',
  'unknown': 'type-unknown',
  'resource': 'type-resource',
};

@Component({
  selector: 'ng-signals-details',
  templateUrl: './signals-details.component.html',
  styleUrl: './signals-details.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SignalsValueTreeComponent, MatIcon, ButtonComponent],
})
export class SignalsDetailsComponent {
  private readonly signalGraph = inject(SignalGraphManager);
  private readonly messageBus = inject(MessageBus);

  protected readonly node = input.required<DevtoolsSignalGraphNode>();

  protected readonly gotoSource = output<DevtoolsSignalGraphNode>();
  protected readonly close = output<void>();

  protected readonly TYPE_CLASS_MAP = TYPE_CLASS_MAP;

  protected readonly isSignalNode = isSignalNode;

  protected readonly name = computed(() => {
    const node = this.node();
    if (isSignalNode(node) && node.groupId) {
      const match = checkResourceGroupMatch(node);
      if (match) {
        return match.signalName;
      }
    }
    return node.label;
  });

  protected readonly group = computed(() => {
    const node = this.node();
    if (isSignalNode(node) && node.groupId) {
      return this.signalGraph.graph()?.groups[node.groupId] || null;
    }
    return null;
  });

  protected treeControl = computed<FlatTreeControl<FlatNode>>(() => {
    return new FlatTreeControl(
      (node) => node.level,
      (node) => node.expandable,
    );
  });

  protected dataSource = computed<DataSource<FlatNode> | null>(() => {
    const selectedNode = this.node();
    if (!selectedNode || isGroupNode(selectedNode)) {
      return null;
    }

    return new SignalDataSource(
      selectedNode.preview,
      new MatTreeFlattener<Property, FlatNode, FlatNode>(
        (node, level) => ({
          expandable: node.descriptor.expandable,
          prop: node,
          level,
        }),
        (node) => node.level,
        (node) => node.expandable,
        (prop) => {
          const descriptor = prop.descriptor;
          if (descriptor.type === PropType.Object || descriptor.type === PropType.Array) {
            return arrayifyProps(descriptor.value || {}, prop);
          }
          return;
        },
      ),
      this.treeControl(),
      {element: this.signalGraph.element()!, signalId: selectedNode.id},
      this.messageBus,
    );
  });
}
