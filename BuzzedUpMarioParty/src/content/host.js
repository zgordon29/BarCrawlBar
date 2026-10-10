// Lines for Sal, the bartender who hosts the game. {name} is replaced with the player involved.
// Each event has PG-13 lines and optional R-rated extras that are added to the pool in the R game.

const LINES = {
  welcome: {
    pg: ['Welcome to the crawl. Five bars, one bottle cap at a time.', 'Evening. Try not to break anything I have to clean.'],
    r: ['Welcome, degenerates. Let\'s make some bad decisions.'],
  },
  turn: {
    pg: ['{name}, you\'re up. Try to walk in a straight line.', 'Roll it, {name}. The night isn\'t getting younger.', '{name}\'s turn. I believe in you. Mostly.'],
    r: ['{name}, quit stalling and roll the damn dice.', 'Up you get, {name}. Assuming you still can.'],
  },
  roll1: {
    pg: ['A one. Bold.', 'One whole space. Pace yourself, {name}.'],
    r: ['A one. My grandmother crawls faster than that, {name}.'],
  },
  rollMax: {
    pg: ['A ten! Somebody is in a hurry.', '{name} is sprinting. Hydrate.'],
    r: ['Ten! {name} is moving like the cops just showed up.'],
  },
  coin: {
    pg: ['Tips for {name}.', 'A few coins. Don\'t spend them all in one bar.'],
    r: ['Money for {name}. Finally contributing to society.'],
  },
  bad: {
    pg: ['That\'ll cost you, {name}.', 'The tab always finds you.'],
    r: ['Pay up, {name}. I don\'t run a charity.'],
  },
  drink: {
    pg: ['Drink up, {name}.', 'That one\'s yours, {name}.', 'Down the hatch.'],
    r: ['Drink, {name}. You look too comfortable.', 'Bottoms up, {name}. Regret is tomorrow\'s problem.'],
  },
  give: {
    pg: ['{name} is buying. Choose a victim.', 'Share the wealth, {name}.'],
    r: ['{name} gets to ruin someone\'s night. Choose wisely.'],
  },
  round: {
    pg: ['A round for the whole table!', 'Everybody drinks. I love this job.'],
    r: ['Everybody drinks! Nobody is safe and I\'m thrilled.'],
  },
  card: {
    pg: ['Let\'s see what the night has in store.', 'Pick a card, {name}.'],
    r: ['A card for {name}. This should be humiliating.'],
  },
  capBuy: {
    pg: ['A bottle cap for {name}! Frame it.', '{name} grabs a cap. The crowd goes mild.'],
    r: ['{name} got a cap. Enjoy it, it\'s the high point of your night.'],
  },
  capBroke: {
    pg: ['No coins, no cap. Them\'s the rules, {name}.', 'Come back with money, {name}.'],
    r: ['{name} is broke. The cap laughs at you.'],
  },
  capSkip: {
    pg: ['{name} walks right past it. Interesting strategy.'],
    r: [],
  },
  minigame: {
    pg: ['Time to settle this like adults: with a silly game.', 'Minigame time. Loser drinks.'],
    r: ['Minigame time. Try not to embarrass yourselves. More.'],
  },
  lastCall: {
    pg: ['LAST CALL! Five turns left. Coin spaces are doubled and duels are on.', 'Last call, everybody. Make it count.'],
    r: ['LAST CALL, you animals. Double coins, duels, zero dignity.'],
  },
  happyHour: {
    pg: ['HAPPY HOUR! Caps and items are half price this turn.', 'It\'s Happy Hour. Spend like you mean it.'],
    r: ['HAPPY HOUR. Half price everything, full price regrets.'],
  },
  shop: {
    pg: ['Take a look, {name}. No refunds.', 'Something for the road, {name}?'],
    r: ['Buy something or get out, {name}.'],
  },
  item: {
    pg: ['Somebody left this behind. It\'s yours now, {name}.', 'A freebie for {name}.'],
    r: ['Finders keepers, {name}. Don\'t ask where it\'s been.'],
  },
  hustler: {
    pg: ['The Hustler wants a word, {name}.', 'Careful, {name}. That guy has never done an honest day\'s work.'],
    r: ['The Hustler. He\'ll rob your friends for a fiver, {name}.'],
  },
  steal: {
    pg: ['Ooh. {name} is not going to forget that.', 'Daylight robbery. Poor {name}.'],
    r: ['{name} just got robbed blind. Friendship is dead.'],
  },
  tipJar: {
    pg: ['{name} walks off with the tip jar. I saw that.', 'That was for the staff, {name}.'],
    r: ['{name} stole the tip jar. Classy.'],
  },
  chance: {
    pg: ['Spin the bottle! Somebody\'s night is about to change.', 'Round and round it goes, {name}.'],
    r: ['Spin the bottle. Somebody is about to get screwed.'],
  },
  tab: {
    pg: ['The tab has arrived, {name}. I\'d sit down.', 'Somebody has to pay for all this, {name}.'],
    r: ['Here\'s the damage, {name}. Don\'t cry on my bar.'],
  },
  battle: {
    pg: ['BAR FIGHT! Everybody ante up.', 'Chairs are flying. Coins on the table, please.'],
    r: ['BAR FIGHT! Money down, you lunatics.'],
  },
  duel: {
    pg: ['A duel! Step outside, {name}.', 'Somebody has a score to settle with {name}.'],
    r: ['A duel with {name}. Take it outside, I just mopped.'],
  },
  hidden: {
    pg: ['Well, look what {name} found.', 'Who leaves that lying around?'],
    r: ['{name}, you lucky so-and-so.'],
  },
  hammered: {
    pg: ['{name} is officially hammered. Somebody get them a water.', 'I\'m cutting {name} off. Just kidding, I can\'t.'],
    r: ['{name} is absolutely wrecked. Beautiful.'],
  },
  alley: {
    pg: ['A fork. The back ways are quick, but nobody comes out of them less thirsty.', 'Short cut, or the scenic route?', 'Kirkwood gets you there faster. It also gets you.'],
    r: ['The back way. Quick, dark, and it smells like consequences.'],
  },
  final: {
    pg: ['That\'s the crawl! Let\'s see who was least bad at it.', 'Closing time. Let\'s count caps.'],
    r: ['Closing time. You don\'t have to go home but you can\'t stay here.'],
  },
};

export function hostLine(event, rating, name = '') {
  const set = LINES[event];
  if (!set) return '';
  const pool = rating === 'r' ? [...set.pg, ...set.r, ...set.r] : set.pg;
  return pool[Math.floor(Math.random() * pool.length)].replaceAll('{name}', name);
}
