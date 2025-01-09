import {stringifyParsedValue} from './utils';

describe('CSS Value Parser Utils', () => {
  describe('stringifyParsedValue', () => {
    it('should stringify a static value', () => {
      const output = stringifyParsedValue({
        type: 'static',
        value: 'block',
      });

      expect(output).toEqual('block');
    });

    it('should stringify a color value', () => {
      const output = stringifyParsedValue({
        type: 'color',
        value: '#ff0000',
      });

      expect(output).toEqual('#ff0000');
    });

    it('should stringify a single numeric value', () => {
      const output = stringifyParsedValue({
        type: 'numeric',
        values: [[42, 'px']],
      });

      expect(output).toEqual('42px');
    });

    it('should stringify a unitless numeric value', () => {
      const output = stringifyParsedValue({
        type: 'numeric',
        values: [[1337, '']],
      });

      expect(output).toEqual('1337');
    });

    it('should stringify multiple numeric values', () => {
      const output = stringifyParsedValue({
        type: 'numeric',
        values: [
          [42, 'px'],
          [13.37, '%'],
          [0, 'rem'],
        ],
      });

      expect(output).toEqual('42px 13.37% 0rem');
    });

    it('should stringify multiple unitless values', () => {
      const output = stringifyParsedValue({
        type: 'numeric',
        values: [
          [42, ''],
          [13.37, ''],
          [0, ''],
        ],
      });

      expect(output).toEqual('42 13.37 0');
    });

    it('should stringify a transform value', () => {
      const output = stringifyParsedValue({
        type: 'transform',
        values: new Map([['translate', [[42, 'px']]]]),
      });

      expect(output).toEqual('translate(42px)');
    });

    it('should stringify a transform value with a function with multiple paramters', () => {
      const output = stringifyParsedValue({
        type: 'transform',
        values: new Map([
          [
            'translate',
            [
              [42, 'px'],
              [13.37, '%'],
            ],
          ],
        ]),
      });

      expect(output).toEqual('translate(42px, 13.37%)');
    });

    it('should stringify a transform value with multiple functions', () => {
      const output = stringifyParsedValue({
        type: 'transform',
        values: new Map([
          [
            'translate',
            [
              [42, 'px'],
              [13.37, '%'],
            ],
          ],
          ['scale', [[1.5, '']]],
        ]),
      });

      expect(output).toEqual('translate(42px, 13.37%) scale(1.5)');
    });
  });
});
