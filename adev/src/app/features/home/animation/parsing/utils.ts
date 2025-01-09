import {CssPropertyValue} from './types';

/**
 * Convert a parsed CSS property value to its string representation.
 *
 * @param value Parsed CSS property value
 * @returns String CSS property value
 */
export function stringifyParsedValue(value: CssPropertyValue): string {
  switch (value.type) {
    case 'numeric':
      return value.values.map(([num, unit]) => num + unit).join(' ');
    case 'transform':
      return Array.from(value.values)
        .map(
          ([fnName, numData]) =>
            `${fnName}(${numData.map(([num, unit]) => num + unit).join(', ')})`,
        )
        .join(' ');
    case 'color':
    case 'static':
      return value.value;
  }
}
