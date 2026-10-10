// Numbers that define the board game's rules and layout. Values follow classic Mario Party
// (mainly Mario Party 2) unless noted.
import { W } from '../config.js';

export const CAP_COST = 20;          // a Star costs 20 coins
export const DIE_MAX = 10;           // ten-sided die
export const LAST_CALL_TURNS = 5;    // "last five turns": coin spaces double and duels open up
export const HAPPY_HOUR_EVERY = 5;   // every fifth turn caps and items are half price
export const MAX_ITEMS = 3;          // items a player can carry (Mario Party 3 onwards)
export const STEAL_COINS_FEE = 5;    // Boo: 5 coins to steal coins...
export const STEAL_CAP_FEE = 50;     // ...50 to steal a Star
export const TIP = 5;                // bank: deposit 5 when passing
export const COIN_SPACE = 3;         // blue +3 / red -3
export const HIDDEN_STASH_CHANCE = 0.05;
export const FRENZY_TURNS = 5;       // five-turn game: everyone starts with 50 coins, a cap and an item

export const STEP_TIME = 0.26;
export const CPU_DELAY = 0.9;
export const OVERVIEW = 0.46;        // camera zoom that shows the whole crawl
export const NEAR_ZOOM = 0.85;       // camera zoom when following a player
export const VIEW_X = W / 2;         // screen x the camera centres on
export const PROMPT_X = W / 2;       // where prompts and menus are centred
export const LAST_CALL_SPEED = 1.25; // the final turns play a little faster
export const FAST_FORWARD = 2.5;     // holding A during a computer player's turn speeds it up
