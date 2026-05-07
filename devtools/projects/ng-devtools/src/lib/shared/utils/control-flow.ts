/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {
  ControlFlowBlock,
  ControlFlowBlockType,
  DeferBlock,
  ForLoopBlock,
  IfBlock,
  IfBranchBlock,
  SwitchBlock,
  SwitchBranchBlock,
} from '../../../../../protocol';

export const BlockType = {
  isDeferBlock(node: ControlFlowBlock | null): node is DeferBlock {
    return !!node && node.type === ControlFlowBlockType.Defer;
  },

  isForLoopBlock(node: ControlFlowBlock | null): node is ForLoopBlock {
    return !!node && node.type === ControlFlowBlockType.For;
  },

  isIfBlock(node: ControlFlowBlock | null): node is IfBlock {
    return !!node && node.type === ControlFlowBlockType.If;
  },

  isConditionalBlock(
    node: ControlFlowBlock | null,
  ): node is IfBlock | IfBranchBlock | SwitchBlock | SwitchBranchBlock {
    return (
      !!node &&
      (node.type === ControlFlowBlockType.If ||
        node.type === ControlFlowBlockType.IfBranch ||
        node.type === ControlFlowBlockType.Switch ||
        node.type === ControlFlowBlockType.SwitchBranch)
    );
  },
};
