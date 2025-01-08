/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {cssValueLexer} from './css-value-lexer';
import {CssPropertyValue, NumericValue, TransformValue} from './types';

interface ParserHandler {
  (tokens: (string | number)[]): CssPropertyValue | null;
}

//
// Handlers
//

const singleUnitlessNumericValueHandler: ParserHandler = (tokens) => {
  if (tokens.length === 1 && typeof tokens[0] === 'number') {
    return {
      type: 'numeric',
      values: [[tokens[0], '']],
    };
  }
  return null;
};

const staticColorValueHandler: ParserHandler = (tokens) => {
  if (tokens.length === 1 && typeof tokens[0] === 'string') {
    const token = tokens[0];
    return {
      type: token[0] === '#' ? 'color' : 'static',
      value: token,
    };
  }
  return null;
};

const numericValueHandler: ParserHandler = (tokens) => {
  if (tokens.length > 1 && typeof tokens[0] === 'number') {
    const value: NumericValue = {
      type: 'numeric',
      values: [],
    };
    let currPair = [];
    let isValid = true;

    for (const token of tokens) {
      currPair.push(token);

      if (
        currPair.length === 2 &&
        typeof currPair[0] === 'number' &&
        typeof currPair[1] === 'string'
      ) {
        value.values.push(currPair as [number, string]);
        currPair = [];
      } else {
        isValid = false;
        break;
      }
    }

    if (isValid) {
      return value;
    }
  }
  return null;
};

const transformValueHandler: ParserHandler = (tokens) => {
  if (tokens.length > 1 && typeof tokens[0] === 'string') {
    const value: TransformValue = {
      type: 'tranform',
      values: new Map(),
    };

    // TBD
  }
  return null;
};

// Include all handlers that should be part of the parsing here.
const parserHandlers = [
  singleUnitlessNumericValueHandler,
  staticColorValueHandler,
  numericValueHandler,
  transformValueHandler,
];

//
// Parser function
//

/**
 * Parse a string to a `CssPropertyValue`.
 *
 * @param value CSS property value
 * @returns Parser CSS property value
 */
export function cssValueParser(value: string): CssPropertyValue {
  const tokens = cssValueLexer(value);

  for (const handler of parserHandlers) {
    const value = handler(tokens);
    if (value) {
      return value;
    }
  }

  // If not handled
  return {
    type: 'static',
    value,
  };
}
