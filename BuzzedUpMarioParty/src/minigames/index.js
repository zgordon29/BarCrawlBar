import walkTheLine from './walkTheLine.js';
import lastCallBrawl from './lastCallBrawl.js';
import trayDash from './trayDash.js';
import barSlide from './barSlide.js';
import glassRain from './glassRain.js';
import pourDecisions from './pourDecisions.js';
import dartHustle from './dartHustle.js';
import limeGrab from './limeGrab.js';
import kegCarry from './kegCarry.js';
import coasterHockey from './coasterHockey.js';
import shakeAndServe from './shakeAndServe.js';
import tugOfTab from './tugOfTab.js';
import theBouncer from './theBouncer.js';
import dineAndDash from './dineAndDash.js';
import bartendersRevenge from './bartendersRevenge.js';
import rollingOlive from './rollingOlive.js';

export const MINIGAMES = [
  walkTheLine, lastCallBrawl, trayDash, barSlide, glassRain, pourDecisions, dartHustle, limeGrab,
  kegCarry, coasterHockey, shakeAndServe, tugOfTab,
  theBouncer, dineAndDash, bartendersRevenge, rollingOlive,
];

export const TYPE_LABELS = { ffa: 'Free-for-all', '2v2': '2 vs 2', '1v3': '1 vs 3' };

// Team games need a full table of four.
export function playable(game, playerCount) {
  return game.type === 'ffa' || playerCount === 4;
}
