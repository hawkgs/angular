import {ParsedStyles} from './types';
import {stylesUnion} from './utils';

describe('Animation utils', () => {
  describe('stylesUnion', () => {
    it('should handle empty styles', () => {
      const styles: ParsedStyles = {'background': {type: 'static', value: 'red'}};
      const output = stylesUnion(styles, {});
      expect(output).toEqual(styles);
    });

    it('should unionize two non-intersecting styles', () => {
      const base: ParsedStyles = {
        'opacity': {
          type: 'numeric',
          values: [[0.5, '']],
        },
      };
      const newStyles: ParsedStyles = {
        'background': {
          type: 'static',
          value: 'red',
        },
      };

      const output = stylesUnion(base, newStyles);
      expect(output).toEqual({...base, ...newStyles});
    });

    it('should unionize two intersecting styles', () => {
      const base: ParsedStyles = {
        'font-weight': {
          type: 'static',
          value: 'bold',
        },
        'opacity': {
          type: 'numeric',
          values: [[0.5, '']],
        },
      };
      const newStyles: ParsedStyles = {
        'background': {
          type: 'static',
          value: 'red',
        },
        'opacity': {
          type: 'numeric',
          values: [[0.75, '']],
        },
      };

      const output = stylesUnion(base, newStyles);
      expect(output).toEqual({
        'background': {
          type: 'static',
          value: 'red',
        },
        'opacity': {
          type: 'numeric',
          values: [[0.75, '']],
        },
        'font-weight': {
          type: 'static',
          value: 'bold',
        },
      });
    });

    it('should unionize styles that contain transform', () => {
      const base: ParsedStyles = {
        'background': {
          type: 'static',
          value: 'red',
        },
      };
      const newStyles: ParsedStyles = {
        'transform': {
          type: 'transform',
          values: new Map([['scale', [[1, '']]]]),
        },
      };

      const output = stylesUnion(base, newStyles);
      expect(output).toEqual({...base, ...newStyles});
    });

    it('should unionize two intersecting styles that contain non-intersecting transform functions', () => {
      const base: ParsedStyles = {
        'transform': {
          type: 'transform',
          values: new Map([['rotate', [[180, 'deg']]]]),
        },
      };
      const newStyles: ParsedStyles = {
        'transform': {
          type: 'transform',
          values: new Map([['scale', [[2, '']]]]),
        },
      };

      const output = stylesUnion(base, newStyles);
      expect(output).toEqual({
        'transform': {
          type: 'transform',
          values: new Map([
            ['rotate', [[180, 'deg']]],
            ['scale', [[2, '']]],
          ]),
        },
      });
    });

    it('should unionize two intersecting styles that contain intersecting transform functions', () => {
      const base: ParsedStyles = {
        'transform': {
          type: 'transform',
          values: new Map([
            ['rotate', [[180, 'deg']]],
            ['scale', [[2, '']]],
          ]),
        },
      };
      const newStyles: ParsedStyles = {
        'transform': {
          type: 'transform',
          values: new Map([['rotate', [[270, 'deg']]]]),
        },
      };

      const output = stylesUnion(base, newStyles);
      expect(output).toEqual({
        'transform': {
          type: 'transform',
          values: new Map([
            ['rotate', [[270, 'deg']]],
            ['scale', [[2, '']]],
          ]),
        },
      });
    });
  });
});
