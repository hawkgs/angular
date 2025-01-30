import {AnimationDefinition, Styles} from '../home/animation';
import {AnimationRule} from '../home/animation/types';

// Layers and layer objects selectors
const LOGO_LAYER_ID = 'logo';
const LOGO = `${LOGO_LAYER_ID} >> .logo`;
const SHIELD = `${LOGO_LAYER_ID} >> .shield`;
const SHIELD_MIDDLE = `${LOGO_LAYER_ID} >> .shield-middle`;
const SHIELD_BOTTOM_A_ARC = `${LOGO_LAYER_ID} >> .shield-bottom-a-arc`;
const SHIELD_BOTTOM_EXTENSION = `${LOGO_LAYER_ID} >> .shield-bottom-extension`;
const CAPITAL_A_LETTER = `${LOGO_LAYER_ID} >> .capt-a-letter`;
const N_LETTER = `${LOGO_LAYER_ID} >> .n-letter`;
const G_LETTER = `${LOGO_LAYER_ID} >> .g-letter`;
const U_LETTER = `${LOGO_LAYER_ID} >> .u-letter`;
const L_LETTER = `${LOGO_LAYER_ID} >> .l-letter`;
const A_LETTER = `${LOGO_LAYER_ID} >> .a-letter`;
const R_LETTER = `${LOGO_LAYER_ID} >> .r-letter`;

const WORKS_AT_ANY_SCALE_LAYER = 'works-at-any-scale';

const METEOR_FIELD_LAYER = 'meteor-field';
const METEOR_FIELD = `${METEOR_FIELD_LAYER} >> .field`;

function hideLetter(selector: string, startTime: number): AnimationRule<Styles> {
  const endTime = startTime + 1; // 1 sec duration
  return {
    selector: selector,
    timespan: [startTime, endTime],
    from: {
      opacity: '1',
    },
    to: {
      opacity: '0',
    },
  };
}

/** Generate the animation definition for the home page. */
export function generateHomeAnimationDefinition(meteorsCount: number): AnimationDefinition {
  // Logo layer animation
  const logoLayerAnim: AnimationDefinition = [
    {
      selector: LOGO,
      timespan: [0, 5],
      from: {
        transform: 'translateX(0)',
      },
      to: {
        transform: 'translateX(467px)',
      },
    },
    hideLetter(R_LETTER, 1),
    hideLetter(A_LETTER, 1.5),
    hideLetter(L_LETTER, 2),
    hideLetter(U_LETTER, 2.5),
    hideLetter(G_LETTER, 3),
    hideLetter(N_LETTER, 3.5),
    // Make sure that the last letter disappers at the end of layer transition,
    // i.e. 4 + 1 = 5th second end time
    hideLetter(CAPITAL_A_LETTER, 4),
    {
      selector: SHIELD_MIDDLE,
      timespan: [5.5, 5.6],
      from: {
        transform: 'scale(1)',
      },
      to: {
        transform: 'scale(0)',
      },
    },
    {
      selector: SHIELD_BOTTOM_A_ARC,
      timespan: [5.5, 5.6],
      from: {
        transform: 'scaleY(1)',
      },
      to: {
        transform: 'scaleY(0)',
      },
    },
    {
      selector: SHIELD_BOTTOM_EXTENSION,
      timespan: [5.5, 5.6],
      from: {
        transform: 'scale(0)',
      },
      to: {
        transform: 'scale(1)',
      },
    },
    {
      selector: SHIELD,
      timespan: [5.5, 10],
      from: {
        transform: 'scale(1) rotate(0deg)',
      },
      to: {
        transform: 'scale(20) rotate(-270deg)',
      },
    },
  ];

  // "Works at any scale" layer animation
  const waasLayerAnim: AnimationDefinition = [
    {
      selector: WORKS_AT_ANY_SCALE_LAYER,
      timespan: [5, 10],
      from: {
        transform: 'scale(0)',
        opacity: '0',
      },
      to: {
        transform: 'scale(1)',
        opacity: '1',
      },
    },
    {
      selector: WORKS_AT_ANY_SCALE_LAYER,
      timespan: [14, 15.5],
      from: {
        transform: 'scale(1)',
        opacity: '1',
      },
      to: {
        transform: 'scale(1.5)',
        opacity: '0',
      },
    },
  ];

  // Meteor field layer animation
  const meteorFieldLayerAnim: AnimationDefinition = [
    {
      selector: METEOR_FIELD,
      at: 13,
      styles: {
        display: 'flex',
      },
    },
    {
      selector: METEOR_FIELD,
      timespan: [14, 15],
      from: {
        opacity: '0',
      },
      to: {
        opacity: '1',
      },
    },
    {
      selector: METEOR_FIELD,
      timespan: [13, 16],
      from: {
        transform: 'scale(1.42)',
      },
      to: {
        transform: 'scale(1)',
      },
    },
  ];

  return [...logoLayerAnim, ...waasLayerAnim, ...meteorFieldLayerAnim];
}
