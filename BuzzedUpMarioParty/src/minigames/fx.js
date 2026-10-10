// Feedback events. A minigame (or one of the helpers in kit.js) says what just happened; the
// runner turns it into a sound, sparks, a camera shake, a freeze frame and a buzz on the right
// controller, all at once, so every hit lands the same way in every game.
//
// Kinds:
//   dash   someone burst forward
//   shove  someone was knocked back (seat = who did it, hit = who took it)
//   hit    someone took damage but is still in
//   out    someone is out of the game
//   score  something good: a goal, a point, a finish line crossed
//   fail   something bad: a spill, a stumble, a bust
const queue = [];

// at: where it happened and to whom: { x, y, seat, hit }. Any of them may be missing; a mover
// can be passed as it is, since drive() in kit.js records which seat is steering it.
export function emit(kind, at = {}) {
  queue.push({ kind, x: at.x, y: at.y, seat: at.seat, hit: at.hit });
}

// Hands over everything that has happened since the last call.
export function drain() {
  return queue.splice(0);
}
