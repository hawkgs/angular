/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import {MatIcon} from '@angular/material/icon';

import {
  DevtoolsSignalGraph,
  DevtoolsSignalGraphCluster,
  DevtoolsSignalGraphNode,
} from '../../signal-graph';
import {SignalsGraphVisualizer} from './signals-visualizer';
import {ElementPosition} from '../../../../../../../protocol';
import {ButtonComponent} from '../../../../shared/button/button.component';

@Component({
  selector: 'ng-signals-visualizer',
  templateUrl: './signals-visualizer.component.html',
  styleUrl: './signals-visualizer.component.scss',
  imports: [ButtonComponent, MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignalsVisualizerComponent {
  protected readonly svgHost = viewChild.required<ElementRef>('host');

  private signalsVisualizer?: SignalsGraphVisualizer;

  protected readonly graph = input.required<DevtoolsSignalGraph | null>();
  protected readonly selectedNodeId = input.required<string | null>();
  protected readonly element = input.required<ElementPosition | undefined>();
  protected readonly nodeClick = output<DevtoolsSignalGraphNode>();
  protected readonly clusterHide = output<string>();

  private readonly visibleClustersIds = signal<Set<string>>(new Set());
  protected readonly visibleClusters = computed<DevtoolsSignalGraphCluster[]>(() => {
    const clusterIds = this.visibleClustersIds();
    const graph = untracked(this.graph);
    if (!clusterIds || !graph) {
      return [];
    }
    return Array.from(clusterIds).map((id) => graph.clusters[id]);
  });

  private onResize = () => this.signalsVisualizer?.resize();
  private observer = new ResizeObserver(this.onResize);

  constructor() {
    const renderGraph = () => {
      const graph = this.graph();
      if (graph) {
        this.signalsVisualizer?.render(graph);
      }
    };
    const setSelected = () => {
      const selected = this.selectedNodeId();
      if (selected) {
        this.signalsVisualizer?.setSelected(selected);
      }
    };

    afterNextRender({
      write: () => {
        this.setUpSignalsVisualizer();
        renderGraph();
        setSelected();
        this.observer.observe(this.svgHost().nativeElement);
      },
    });

    effect(renderGraph);
    effect(setSelected);

    effect(() => {
      // Reset the visualizer when the element changes.
      this.element();
      this.signalsVisualizer?.reset();
    });

    inject(DestroyRef).onDestroy(() => {
      this.observer.disconnect();
      this.signalsVisualizer?.cleanup();
    });
  }

  setUpSignalsVisualizer() {
    this.signalsVisualizer = new SignalsGraphVisualizer(this.svgHost().nativeElement);
    this.signalsVisualizer.onNodeClick((node) => {
      this.nodeClick.emit(node);
    });
    this.signalsVisualizer.onClustersVisibilityChange((visibleClusters) => {
      this.visibleClustersIds.set(visibleClusters);
    });
  }

  hideCluster(id: string) {
    this.signalsVisualizer?.setClusterVisibility(id, false);
    this.clusterHide.emit(id);
  }
}
