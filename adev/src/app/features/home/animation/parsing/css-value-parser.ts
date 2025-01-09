/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {cssValueLexer} from './css-value-lexer';
import {CssPropertyValue, NumericValue, TransformValue} from './types';

// Transform functions that can be parsed
const SUPPORTED_FUNCS = [
  'translate',
  'rotate',
  'scale',
  'skew',
  'translateX',
  'translateY',
  'translateZ',
  'scaleX',
  'scaleY',
  'scaleZ',
  'skewX',
  'skewY',
];

interface ParserHandler {
  (tokens: (string | number)[]): CssPropertyValue | null;
}

//
// Handlers
//

const staticAndColorValuesHandler: ParserHandler = (tokens) => {
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
  if (typeof tokens[0] === 'number') {
    const value: NumericValue = {
      type: 'numeric',
      values: [],
    };
    let buffer = [];

    for (const token of tokens) {
      buffer.push(token);

      if (buffer.length === 2 && typeof buffer[0] === 'number' && typeof buffer[1] === 'string') {
        value.values.push(buffer as [number, string]);
        buffer = [];
      }
    }

    // If the values do not match number-unit format
    if (buffer.length) {
      const numbersOnly = !buffer.find((v) => typeof v === 'string');
      // Invalid
      if (!numbersOnly) {
        return null;
      }

      const pairs = buffer.map((v) => [v, ''] as [number, string]);
      value.values = [...value.values, ...pairs];
    }

    return value;
  }

  return null;
};

const transformValueHandler: ParserHandler = (tokens) => {
  if (tokens.length > 1 && typeof tokens[0] === 'string') {
    const value: TransformValue = {
      type: 'transform',
      values: new Map(),
    };
    let functionName = '';
    let paramPairs: [number, string][] = [];
    let paramBuffer: unknown[] = [];
    let isValid = true;

    const isBufferNumOnly = () => !paramBuffer.find((v) => typeof v === 'string');

    for (const token of tokens) {
      // If function name is found
      if (typeof token === 'string' && SUPPORTED_FUNCS.includes(token)) {
        // If there is already an extracted function, add it to the values map
        if (paramPairs.length || paramBuffer.length) {
          // If the param buffer is full, this means that it doesn't
          // match the usual [number, string][] pattern (i.e. it should be numbers-only)
          if (paramBuffer.length) {
            if (!isBufferNumOnly()) {
              isValid = false;
              break;
            }

            const pairs = paramBuffer.map((v) => [v, ''] as [number, string]);
            paramPairs = paramPairs.concat(pairs);
          }

          value.values.set(functionName, paramPairs);
          paramPairs = [];
          paramBuffer = [];
        }

        functionName = token;
      } else if (functionName) {
        // Handle standard param pairs – number + unit
        paramBuffer.push(token);

        if (
          paramBuffer.length === 2 &&
          typeof paramBuffer[0] === 'number' &&
          typeof paramBuffer[1] === 'string'
        ) {
          paramPairs.push(paramBuffer as [number, string]);
          paramBuffer = [];
        }
      }
    }

    // Check for remaining functions after the loop has completed
    if (functionName && (paramPairs.length || paramBuffer.length)) {
      if (paramBuffer.length && isBufferNumOnly()) {
        const pairs = paramBuffer.map((v) => [v, ''] as [number, string]);
        paramPairs = paramPairs.concat(pairs);
      }

      if (paramPairs.length) {
        value.values.set(functionName, paramPairs);
      }
    }

    if (isValid && value.values.size) {
      return value;
    }
  }
  return null;
};

// Include all handlers that should be part of the parsing here.
const parserHandlers = [staticAndColorValuesHandler, numericValueHandler, transformValueHandler];

//
// Parser function
//

/**
 * Parse a string to a `CssPropertyValue`.
 *
 * @param value CSS property value
 * @returns Parsed CSS property value
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
