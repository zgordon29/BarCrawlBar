// Event cards drawn on "?" spaces.
//
// t: title, x: text ({me} = the player who drew it), fx: list of effects, bar: only drawn in that bar,
// r: true = only in the R-rated deck.
//
// Effects:
//   sip n            you sip                      give n        you hand out n sips
//   all n            everyone sips                others n      everyone but you sips
//   coins n          you gain/lose coins          allCoins n    everyone gains/loses coins
//   steal n          take coins from the richest  flip win lose coin flip for coins
//   move n           move forward/back n spaces   swap          swap places with someone random
//   soberest n       least drunk player sips      richest n     richest player sips
//   lastPlace n      player in last gets coins    drunkestCoins n  drunkest player gets coins
//   capMove          the bottle cap moves bars
//   dare n coins     do it for coins, or sip n    pick n ask    {me} picks who sips n
//   rule             a house rule that stays until another replaces it
//   honor            nothing to track; the table sorts it out

export const CARDS = [
  // --- Anywhere, PG-13 ---
  { t: 'Happy Hour', x: 'Drinks are half price. Everyone pockets 5 coins.', fx: [{ k: 'allCoins', n: 5 }] },
  { t: 'Tab\'s On You', x: 'Somebody has to pay. Lose 5 coins.', fx: [{ k: 'coins', n: -5 }] },
  { t: 'Found a Twenty', x: 'It was in your other pocket all along. Gain 8 coins.', fx: [{ k: 'coins', n: 8 }] },
  { t: 'Waterfall', x: 'Everyone drinks, starting with {me}.', fx: [{ k: 'all', n: 1 }] },
  { t: 'Cheers!', x: 'Raise a glass and hand out 2 sips.', fx: [{ k: 'give', n: 2 }] },
  { t: 'One for the Road', x: '{me} takes 2 sips. No road involved.', fx: [{ k: 'sip', n: 2 }] },
  { t: 'Designated Thinker', x: 'Someone here is far too sober. The least drunk player sips 2.', fx: [{ k: 'soberest', n: 2 }] },
  { t: 'Buy the Leader a Drink', x: 'Money can\'t buy taste. The richest player sips 2.', fx: [{ k: 'richest', n: 2 }] },
  { t: 'Pity Round', x: 'Whoever is in last place gets 8 coins and our sympathy.', fx: [{ k: 'lastPlace', n: 8 }] },
  { t: 'Pickpocket', x: 'Bump into the richest player and come away with 5 of their coins.', fx: [{ k: 'steal', n: 5 }] },
  { t: 'Wrong Bar', x: 'You walked into the wrong place. Swap spots with a random player.', fx: [{ k: 'swap' }] },
  { t: 'Your Ride\'s Here', x: 'Skip ahead 3 spaces.', fx: [{ k: 'move', n: 3 }] },
  { t: 'Forgot Your Jacket', x: 'Go back 2 spaces to get it.', fx: [{ k: 'move', n: -2 }] },
  { t: 'The Cap Rolls Away', x: 'The bottle cap bounces out the door and into another bar.', fx: [{ k: 'capMove' }] },
  { t: 'Liquid Courage', x: 'The drunkest player gets 6 coins. They have earned it.', fx: [{ k: 'drunkestCoins', n: 6 }] },
  { t: 'On the House', x: 'The bartender is in a good mood. Everyone gains 3 coins.', fx: [{ k: 'allCoins', n: 3 }] },
  { t: 'Double or Nothing', x: 'Flip a coin with the bartender. Win 10 coins or lose 5.', fx: [{ k: 'flip', win: 10, lose: 5 }] },
  { t: 'Accent Night', x: 'Order an imaginary drink in your best British accent.', fx: [{ k: 'dare', n: 1, coins: 4 }] },
  { t: 'Toastmaster', x: 'Give a ten-second toast to the player on your left.', fx: [{ k: 'dare', n: 1, coins: 4 }] },
  { t: 'Air Guitar Solo', x: 'Ten seconds. Full commitment. Face included.', fx: [{ k: 'dare', n: 1, coins: 4 }] },
  { t: 'Mixologist', x: 'Mime making the most complicated cocktail ever invented.', fx: [{ k: 'dare', n: 1, coins: 4 }] },
  { t: 'Compliment Round', x: 'Give everyone at the table one genuine compliment.', fx: [{ k: 'dare', n: 2, coins: 6 }] },
  { t: 'House Rule: No First Names', x: 'Nobody uses first names. Slip up and sip.', fx: [{ k: 'rule' }] },
  { t: 'House Rule: Pinkies Out', x: 'Everyone drinks with a pinky out. Get caught without and sip.', fx: [{ k: 'rule' }] },
  { t: 'House Rule: Thumb Master', x: 'When {me} puts a thumb on the table, the last player to copy sips.', fx: [{ k: 'rule' }] },
  { t: 'House Rule: No Pointing', x: 'Point at anything and you sip. Elbows are fine.', fx: [{ k: 'rule' }] },
  { t: 'Most Likely To…', x: '…lose their phone tonight. The table votes, the winner sips.', fx: [{ k: 'pick', n: 1, ask: 'Who did the table vote for?' }] },
  { t: 'Most Likely To…', x: '…fall asleep first. The table votes, the winner sips.', fx: [{ k: 'pick', n: 1, ask: 'Who did the table vote for?' }] },
  { t: 'Most Likely To…', x: '…order food at 2 a.m. The table votes, the winner sips.', fx: [{ k: 'pick', n: 1, ask: 'Who did the table vote for?' }] },
  { t: 'Categories', x: '{me} names a category, like "beers". Go around the table. First to blank sips.', fx: [{ k: 'pick', n: 1, ask: 'Who blanked?' }] },
  { t: 'Rhyme Time', x: '{me} says a word. Go around rhyming with it. First to fail sips.', fx: [{ k: 'pick', n: 1, ask: 'Who failed?' }] },
  { t: 'Never Have I Ever', x: '{me} says one "never have I ever". Anyone who has done it sips.', fx: [{ k: 'honor' }] },
  { t: 'Staring Contest', x: '{me} picks an opponent. First to blink or laugh sips 2.', fx: [{ k: 'pick', n: 2, ask: 'Who lost?' }] },
  { t: 'Rock Paper Sip', x: '{me} plays the player on the right. Loser sips.', fx: [{ k: 'pick', n: 1, ask: 'Who lost?' }] },

  // --- Sports bar ---
  { t: 'Free Throw', x: 'Step up to the arcade hoop. Sink it for 8 coins, brick it and pay 4.', bar: 'sports', fx: [{ k: 'flip', win: 8, lose: 4 }] },
  { t: 'Free Popcorn', x: 'The popcorn is free, so you sell yours to a freshman. Gain 4 coins.', bar: 'sports', fx: [{ k: 'coins', n: 4 }] },
  { t: 'Go Hoosiers!', x: 'Everyone yells "GO HOOSIERS!" The last one to yell sips.', bar: 'sports', fx: [{ k: 'pick', n: 1, ask: 'Who was last?' }] },
  { t: 'Game Day', x: 'Your team just scored. Hand out 2 sips.', bar: 'sports', fx: [{ k: 'give', n: 2 }] },
  { t: 'Balcony Wave', x: 'Wave to the crowd on Kirkwood like you just won a national title.', bar: 'sports', fx: [{ k: 'dare', n: 1, coins: 4 }] },
  { t: 'Rival Fan', x: 'Trash-talk Purdue for ten straight seconds.', bar: 'sports', fx: [{ k: 'dare', n: 2, coins: 5 }] },
  { t: 'Overtime', x: 'The game went long and so did your tab. Everyone sips.', bar: 'sports', fx: [{ k: 'all', n: 1 }] },

  // --- Pub ---
  { t: 'Bullseye', x: 'You hit the middle of the dartboard on a bet. Gain 6 coins.', bar: 'pub', fx: [{ k: 'coins', n: 6 }] },
  { t: 'Pub Quiz', x: '{me} asks the player on the left a trivia question. Whoever is wrong sips.', bar: 'pub', fx: [{ k: 'pick', n: 1, ask: 'Who sips?' }] },
  { t: 'Sea Shanty', x: 'Sing one line of any song as a sea shanty.', bar: 'pub', fx: [{ k: 'dare', n: 1, coins: 4 }] },
  { t: 'Fireside Story', x: 'Most likely to tell the same story twice tonight. The table votes.', bar: 'pub', fx: [{ k: 'pick', n: 1, ask: 'Who did the table vote for?' }] },
  { t: 'Last Orders', x: 'The bell rings. Everybody else sips while {me} watches.', bar: 'pub', fx: [{ k: 'others', n: 1 }] },
  { t: 'Sink the Glass', x: 'A glass floats in the bucket and everyone pours a little in. Whoever the table says sank it sips 2.', bar: 'pub', fx: [{ k: 'pick', n: 2, ask: 'Who sank it?' }] },

  // --- Dive bar ---
  { t: 'Sticky Floor', x: 'Your shoes are stuck. Go back 2 spaces peeling them off.', bar: 'dive', fx: [{ k: 'move', n: -2 }] },
  { t: 'Jukebox Hero', x: 'Hum a song. If nobody names it in 15 seconds, you failed.', bar: 'dive', fx: [{ k: 'dare', n: 1, coins: 4 }] },
  { t: 'Mystery Shot', x: 'The bartender slides you something green. {me} sips 2.', bar: 'dive', fx: [{ k: 'sip', n: 2 }] },
  { t: 'Pool Shark', x: 'You hustle the richest player out of 4 coins.', bar: 'dive', fx: [{ k: 'steal', n: 4 }] },
  { t: 'Cash Only', x: 'The card machine is "broken". Lose 4 coins at the ATM.', bar: 'dive', fx: [{ k: 'coins', n: -4 }] },

  // --- Video Saloon: pool, darts and arcade machines (the zone id is still 'speak') ---
  { t: 'House Rule: Call Your Shot', x: '{me} must say out loud what they are about to do before every sip. Forget, and sip again.', bar: 'speak', fx: [{ k: 'rule' }] },
  { t: 'Ran the Table', x: 'You cleared the pool table on a guy who "barely plays". Gain 10 coins.', bar: 'speak', fx: [{ k: 'coins', n: 10 }] },
  { t: 'Tilt!', x: 'Somebody shook the pinball machine and the quarters went everywhere. Everyone loses 3 coins.', bar: 'speak', fx: [{ k: 'allCoins', n: -3 }] },
  { t: 'High Score', x: 'Enter your initials on an imaginary arcade machine. Sound effects are required.', bar: 'speak', fx: [{ k: 'dare', n: 1, coins: 4 }] },
  { t: 'Triple Twenty', x: 'Three darts, all in the triple twenty. {me} hands out 2 sips and takes a bow.', bar: 'speak', fx: [{ k: 'give', n: 2 }] },
  { t: 'Scratch', x: 'The cue ball drops in the corner pocket. Lose 4 coins and a little dignity.', bar: 'speak', fx: [{ k: 'coins', n: -4 }] },
  { t: 'Quarters Up', x: 'Your quarters are on the rail, so you play the winner. {me} picks someone for rock paper scissors. Loser sips 2.', bar: 'speak', fx: [{ k: 'pick', n: 2, ask: 'Who lost?' }] },

  // --- The club (PG-13) ---
  { t: 'Dance Floor', x: 'Show the table your signature dance move.', bar: 'club', fx: [{ k: 'dare', n: 1, coins: 4 }] },
  { t: 'Cover Charge', x: 'It was free before eleven. Lose 5 coins.', bar: 'club', fx: [{ k: 'coins', n: -5 }] },
  { t: 'VIP Booth', x: 'Bottle service. Hand out 2 sips.', bar: 'club', fx: [{ k: 'give', n: 2 }] },
  { t: 'DJ Request', x: 'The table votes on who has the worst taste in music. They sip.', bar: 'club', fx: [{ k: 'pick', n: 1, ask: 'Who did the table vote for?' }] },

  // --- R-rated, anywhere ---
  { t: 'Hot Seat', x: 'The table asks {me} one question. Answer honestly.', r: true, fx: [{ k: 'dare', n: 2, coins: 5 }] },
  { t: 'Walk of Shame', x: 'Tell your most embarrassing night-out story.', r: true, fx: [{ k: 'dare', n: 2, coins: 5 }] },
  { t: 'Exes and Ohs', x: 'Most likely to text an ex tonight. The table votes, the winner sips 2.', r: true, fx: [{ k: 'pick', n: 2, ask: 'Who did the table vote for?' }] },
  { t: 'Confession', x: 'Admit something this table does not know about you.', r: true, fx: [{ k: 'dare', n: 2, coins: 5 }] },
  { t: 'Bad Decisions', x: 'Most likely to wake up somewhere unexpected. The table votes.', r: true, fx: [{ k: 'pick', n: 1, ask: 'Who did the table vote for?' }] },
  { t: 'Drunk Dial', x: 'Do an impression of yourself leaving a drunk voicemail.', r: true, fx: [{ k: 'dare', n: 2, coins: 5 }] },
  { t: 'Roast Me', x: 'The player on your right roasts {me} for ten seconds. Take it and sip.', r: true, fx: [{ k: 'sip', n: 1 }] },
  { t: 'Truth Serum', x: 'Who here would {me} trust least with an unlocked phone? They sip.', r: true, fx: [{ k: 'pick', n: 1, ask: 'Who is it?' }] },
  { t: 'Shots Fired', x: 'Hand out 3 sips. Make enemies.', r: true, fx: [{ k: 'give', n: 3 }] },
  { t: 'Beer Goggles', x: 'Describe the player on your left like you are hitting on them at last call.', r: true, fx: [{ k: 'dare', n: 2, coins: 5 }] },
  { t: 'Hangover Preview', x: 'This one is going to hurt tomorrow. {me} sips 3.', r: true, fx: [{ k: 'sip', n: 3 }] },
  { t: 'Kiss, Marry, Avoid', x: 'The table names three celebrities. {me} sorts them out loud.', r: true, fx: [{ k: 'dare', n: 2, coins: 5 }] },
  { t: 'House Rule: Swear Jar', x: 'Anyone who swears sips. Good f***ing luck.', r: true, fx: [{ k: 'rule' }] },
  { t: 'Dirty Mind', x: 'Say the most innocent sentence you can in your filthiest voice.', r: true, fx: [{ k: 'dare', n: 2, coins: 5 }] },
  { t: 'Worst Pickup Line', x: 'Use your worst pickup line on the player across from you.', r: true, fx: [{ k: 'dare', n: 2, coins: 5 }] },
  { t: 'Bathroom Graffiti', x: 'Share the best insult you have ever read on a bathroom wall.', r: true, bar: 'dive', fx: [{ k: 'dare', n: 1, coins: 4 }] },
  { t: 'Loser Buys', x: 'You lost at pool and at darts, back to back. {me} sips 2 and blames the cue.', r: true, bar: 'speak', fx: [{ k: 'sip', n: 2 }] },
  { t: 'Tailgate', x: 'Shotgun pose, everybody. The whole table sips 2.', r: true, bar: 'sports', fx: [{ k: 'all', n: 2 }] },

  // --- R-rated, the club ---
  { t: 'Make It Rain', x: '{me} tips big: lose 6 coins, then hand out 2 sips like a high roller.', r: true, bar: 'club', fx: [{ k: 'coins', n: -6 }, { k: 'give', n: 2 }] },
  { t: 'Amateur Night', x: 'Give the table your best runway strut.', r: true, bar: 'club', fx: [{ k: 'dare', n: 2, coins: 6 }] },
  { t: 'Lap Dance', x: 'Give a chair a three-second lap dance. The chair consents.', r: true, bar: 'club', fx: [{ k: 'dare', n: 2, coins: 6 }] },
  { t: 'Champagne Room', x: 'It costs 8 coins and nobody will say what happened. The soberest player sips 2 while you are gone.', r: true, bar: 'club', fx: [{ k: 'coins', n: -8 }, { k: 'soberest', n: 2 }] },
  { t: 'Stage Name', x: 'The table gives {me} a stage name. It sticks until this rule is replaced. Use the wrong name and sip.', r: true, bar: 'club', fx: [{ k: 'rule' }] },
  { t: 'Bachelor Party', x: 'A bachelor party just walked in. Everyone sips.', r: true, bar: 'club', fx: [{ k: 'all', n: 1 }] },
];

// Picks a card for the bar the player is standing in; half the time it prefers that bar's own cards.
export function drawCard(bar, rating, recent = []) {
  const ok = (c) => (!c.r || rating === 'r') && (!c.bar || c.bar === bar) && !recent.includes(c);
  let pool = CARDS.filter(ok);
  const local = pool.filter((c) => c.bar === bar);
  if (local.length && Math.random() < 0.5) pool = local;
  // In the R-rated game, lean towards the R-rated cards.
  const spicy = pool.filter((c) => c.r);
  if (rating === 'r' && spicy.length && Math.random() < 0.5) pool = spicy;
  if (!pool.length) pool = CARDS.filter((c) => !c.r && !c.bar);
  return pool[Math.floor(Math.random() * pool.length)];
}
