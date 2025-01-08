type NumericValue = {
  type: 'numeric';
  values: [number, string][];
};

type StaticValue = {
  type: 'static';
  value: string;
};

type ColorValue = {
  type: 'color';
  value: string;
};

type TransformValue = {
  type: 'tranform';
  values: Map<string, NumericValue>; // function name, NumericValue
};

export type CssPropertyValue = NumericValue | StaticValue | ColorValue | TransformValue;

const SUPPORTED_FUNCS = ['translate', 'translateX', 'translateY', 'rotate', 'scale'];

interface ParserHandler {
  (tokens: (string | number)[]): CssPropertyValue | null;
}

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

export function cssValueParser(value: string): CssPropertyValue {
  const tokens = cssValueLexer(value);
  const handlers = [
    singleUnitlessNumericValueHandler,
    staticColorValueHandler,
    numericValueHandler,
    transformValueHandler,
  ];

  for (const handler of handlers) {
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

type CharType = 'letter' | 'digit' | 'point' | 'hash' | 'percent' | 'space' | 'bracket' | 'unknown';

function getCharType(char: string): CharType {
  if (char === '.') {
    return 'point';
  }
  if (char === '%') {
    return 'percent';
  }
  if (char === '#') {
    return 'hash';
  }
  if (char === ' ') {
    return 'space';
  }
  if (char === '(' || char === ')') {
    return 'bracket';
  }

  const code = char.charCodeAt(0);

  if (48 <= code && code <= 57) {
    return 'digit';
  }
  if ((65 <= code && code <= 90) || (97 <= code && code <= 122)) {
    return 'letter';
  }
  return 'unknown';
}

const BREAK_SYMBOLS: CharType[] = ['space', 'bracket'];

type BufferType = 'text' | 'number' | null;

function getBufferType(type: CharType): BufferType {
  const textSymbols: CharType[] = ['letter', 'percent', 'hash'];
  const numberSymbols: CharType[] = ['digit', 'point'];

  if (textSymbols.includes(type)) {
    return 'text';
  }
  if (numberSymbols.includes(type)) {
    return 'number';
  }
  return null;
}

export function cssValueLexer(value: string): (string | number)[] {
  const tokens: (string | number)[] = [];
  let buffer = '';
  let bufferType: BufferType | null = null;

  const addToken = () => tokens.push(bufferType === 'number' ? parseFloat(buffer) : buffer);

  for (const char of value) {
    const charType = getCharType(char);
    const newBufferType = getBufferType(charType);

    if (BREAK_SYMBOLS.includes(charType)) {
      addToken();
      buffer = '';
      bufferType = null;
    } else if (newBufferType !== null) {
      if (newBufferType !== bufferType && bufferType !== null) {
        addToken();
        buffer = char;
        bufferType = newBufferType;
      } else if (newBufferType === bufferType || bufferType === null) {
        buffer += char;
        bufferType = newBufferType;
      }
    }
  }

  return tokens;
}
