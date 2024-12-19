type NumericValue = {
  type: 'numeric';
  value: number;
  unit: string;
  function?: string;
};

type StaticValue = {
  type: 'static';
  value: string;
};

type ColorValue = {
  type: 'color';
  value: string;
};

const SUPPORTED_UNITS = ['px', 'em', 'rem', 'pt', '%'];
const SUPPORTED_FUNCS = ['translate', 'translateX', 'translateY'];

export function valueParser(value: string): NumericValue | StaticValue | ColorValue {
  return {
    type: 'static',
    value: 'test',
  };
}
