import {TransformValue} from './parsing';
import {ParsedStyles} from './types';

/**
 * Unionize two `ParsedStyles` into one. `newStyles` overwrites intersected styles.
 * Transform value functions are also unionized where `newStyles` dominates again
 * when there is an intersection.
 *
 * @param base Base styles
 * @param newStyles New styles that overwrite the intersected from the base ones
 * @returns
 */
export function stylesUnion(base: ParsedStyles, newStyles: ParsedStyles): ParsedStyles {
  const union = {...base, ...newStyles};

  if (base['transform'] && newStyles['transform']) {
    const transformBase = base['transform'] as TransformValue;
    const transformNewStyles = newStyles['transform'] as TransformValue;

    union['transform'] = {
      type: 'transform',
      values: new Map([...transformBase.values, ...transformNewStyles.values]),
    };
  }

  return union;
}
