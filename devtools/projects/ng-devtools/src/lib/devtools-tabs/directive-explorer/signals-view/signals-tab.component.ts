/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {
  afterNextRender,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  linkedSignal,
  OnDestroy,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {MatIcon} from '@angular/material/icon';

import {SignalsGraphVisualizer} from './signals-visualizer';
import {Events, MessageBus} from '../../../../../../protocol';
import {ApplicationOperations} from '../../../application-operations/index';
import {FrameManager} from '../../../application-services/frame_manager';
import {SignalsDetailsComponent} from './signals-details/signals-details.component';
import {ButtonComponent} from '../../../shared/button/button.component';
import {SignalGraphManager} from '../signal-graph/signal-graph-manager';
import {DevtoolsSignalGraph, DevtoolsSignalGraphNode} from '../signal-graph';

@Component({
  templateUrl: './signals-tab.component.html',
  selector: 'ng-signals-tab',
  styleUrl: './signals-tab.component.scss',
  imports: [SignalsDetailsComponent, MatIcon, ButtonComponent],
})
export class SignalsTabComponent implements OnDestroy {
  private readonly signalGraph = inject(SignalGraphManager);
  private svgComponent = viewChild.required<ElementRef>('component');

  signalsVisualizer?: SignalsGraphVisualizer;

  protected readonly preselectedNodeId = input<string | null>(null);

  // selected is automatically reset to null whenever `graph` changes
  private selected = linkedSignal<DevtoolsSignalGraph | null, string | null>({
    source: this.signalGraph.graph,
    computation: () => this.preselectedNodeId(),
  });

  private onResize = () => this.signalsVisualizer?.resize();
  private observer = new ResizeObserver(this.onResize);

  private readonly messageBus = inject<MessageBus<Events>>(MessageBus);
  private readonly appOperations = inject(ApplicationOperations);
  private readonly frameManager = inject(FrameManager);

  readonly close = output<void>();

  protected selectedNode = computed(() => {
    const signalGraph = this.signalGraph.graph();
    if (!signalGraph) {
      return undefined;
    }
    const selected = this.selected();
    if (!selected) {
      return undefined;
    }
    return signalGraph.nodes.find((node) => node.id === selected);
  });

  protected readonly detailsVisible = signal(false);

  protected empty = computed(() => !(this.signalGraph.graph()?.nodes.length! > 0));

  constructor() {
    const renderGraph = () => {
      const graph = this.signalGraph.graph();
      if (graph) {
        this.signalsVisualizer?.render(graph);
      }
    };
    const setSelected = () => {
      const selected = this.selected();
      if (selected) {
        this.signalsVisualizer?.setSelected(selected);
      }
    };

    afterNextRender({
      write: () => {
        this.setUpSignalsVisualizer();
        renderGraph();
        setSelected();
        this.observer.observe(this.svgComponent().nativeElement);
      },
    });

    effect(renderGraph);
    effect(setSelected);

    effect(() => {
      // Reset the visualizer when the element changes.
      this.signalGraph.element();
      this.signalsVisualizer?.reset();
    });
  }

  setUpSignalsVisualizer() {
    this.signalsVisualizer = new SignalsGraphVisualizer(this.svgComponent().nativeElement);
    this.signalsVisualizer.onNodeClick((node) => {
      this.selected.set(node.id);
      this.detailsVisible.set(true);
    });
  }

  ngOnDestroy(): void {
    this.observer.disconnect();
    this.signalsVisualizer?.cleanup();
  }

  gotoSource(node: DevtoolsSignalGraphNode) {
    const frame = this.frameManager.selectedFrame();
    this.appOperations.inspectSignal(
      {
        element: this.signalGraph.element()!,
        signalId: node.id,
      },
      frame!,
    );
  }
}
