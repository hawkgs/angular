import {AnimationDefinition} from '../home/animation';

export const ANIMATION_DEFINITION: AnimationDefinition = [
  {
    selector: 'layer-one >> .circle',
    timespan: [0, 7],
    from: {
      'transform': 'translateX(0)',
    },
    to: {
      'transform': 'translateX(500px)',
    },
  },
  {
    selector: 'layer-one >> .circle',
    timespan: [2, 7],
    from: {
      'opacity': '1',
    },
    to: {
      'opacity': '0',
    },
  },
  {
    selector: 'layer-two >> .square',
    timespan: [6, 10],
    from: {
      'opacity': '0',
    },
    to: {
      'opacity': '1',
    },
  },
  {
    selector: 'layer-two >> .square',
    timespan: [8, 15],
    from: {
      'transform': 'scale(1) rotate(0)',
      'background-color': '#118f3d',
    },
    to: {
      'transform': 'scale(10) rotate(270deg)',
      'background-color': '#2154c2',
    },
  },
  {
    selector: 'layer-three >> .final-text',
    at: 14.9,
    styles: {
      'display': 'block',
    },
  },
];
