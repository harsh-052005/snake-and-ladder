/* =========================================================
   Unit tests for the pure game logic (run with: node tests/logic.test.js)
   No test framework needed — a tiny assert harness keeps it dependency-free.
   ========================================================= */
const assert = require('assert');
const {
  SNAKES, LADDERS, BOARD_SIZE,
  rollDie, applyTransition, computeMove, squareToRowCol, GameState,
} = require('../script.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  \u2713 ' + name);
  } catch (e) {
    failed++;
    console.error('  \u2717 ' + name + '\n      ' + e.message);
  }
}

console.log('rollDie');
test('always returns 1..6 across many rolls', () => {
  for (let i = 0; i < 5000; i++) {
    const r = rollDie();
    assert.ok(r >= 1 && r <= 6, `got ${r}`);
    assert.ok(Number.isInteger(r));
  }
});
test('respects injected RNG for each face', () => {
  // rng returns 0 -> 1, just-under-1 -> 6
  assert.strictEqual(rollDie(() => 0), 1);
  assert.strictEqual(rollDie(() => 0.999999), 6);
  assert.strictEqual(rollDie(() => 0.5), 4);
});

console.log('squareToRowCol (zigzag numbering)');
test('square 1 is bottom-left', () => {
  assert.deepStrictEqual(squareToRowCol(1), { row: 9, col: 0 });
});
test('square 10 is bottom-right (end of row 1)', () => {
  assert.deepStrictEqual(squareToRowCol(10), { row: 9, col: 9 });
});
test('square 11 sits directly above square 10 (row reverses)', () => {
  assert.deepStrictEqual(squareToRowCol(11), { row: 8, col: 9 });
});
test('square 20 is leftmost of its row', () => {
  assert.deepStrictEqual(squareToRowCol(20), { row: 8, col: 0 });
});
test('square 100 is top-left', () => {
  assert.deepStrictEqual(squareToRowCol(100), { row: 0, col: 0 });
});
test('square 91 is top-right', () => {
  assert.deepStrictEqual(squareToRowCol(91), { row: 0, col: 9 });
});
test('all 100 squares map to unique cells', () => {
  const seen = new Set();
  for (let s = 1; s <= 100; s++) {
    const { row, col } = squareToRowCol(s);
    assert.ok(row >= 0 && row <= 9 && col >= 0 && col <= 9);
    seen.add(`${row},${col}`);
  }
  assert.strictEqual(seen.size, 100);
});

console.log('applyTransition (snakes & ladders)');
test('every ladder transition lands on its destination', () => {
  for (const [from, to] of Object.entries(LADDERS)) {
    const r = applyTransition(Number(from));
    assert.strictEqual(r.square, to);
    assert.strictEqual(r.type, 'ladder');
  }
});
test('every snake transition lands on its destination', () => {
  for (const [from, to] of Object.entries(SNAKES)) {
    const r = applyTransition(Number(from));
    assert.strictEqual(r.square, to);
    assert.strictEqual(r.type, 'snake');
  }
});
test('neutral square has no transition', () => {
  const r = applyTransition(3);
  assert.strictEqual(r.square, 3);
  assert.strictEqual(r.type, null);
});
test('ladders go up and snakes go down', () => {
  for (const [from, to] of Object.entries(LADDERS)) assert.ok(to > Number(from));
  for (const [from, to] of Object.entries(SNAKES)) assert.ok(to < Number(from));
});
test('no square is both a snake head and a ladder bottom', () => {
  for (const k of Object.keys(LADDERS)) assert.ok(!(k in SNAKES), `conflict at ${k}`);
});

console.log('computeMove (dice 1..6 + exact win rule)');
test('basic move with no transition', () => {
  const m = computeMove(2, 1); // 2+1=3, neutral
  assert.strictEqual(m.final, 3);
  assert.strictEqual(m.moved, true);
  assert.strictEqual(m.transition, null);
  assert.strictEqual(m.won, false);
});
test('landing on a ladder climbs', () => {
  const m = computeMove(0, 1); // -> 1 -> ladder 38
  assert.strictEqual(m.landed, 1);
  assert.strictEqual(m.final, 38);
  assert.strictEqual(m.transition, 'ladder');
});
test('landing on a snake descends', () => {
  const m = computeMove(10, 6); // -> 16 -> snake 6
  assert.strictEqual(m.landed, 16);
  assert.strictEqual(m.final, 6);
  assert.strictEqual(m.transition, 'snake');
});
test('exact roll to 100 wins', () => {
  const m = computeMove(97, 3);
  assert.strictEqual(m.final, 100);
  assert.strictEqual(m.won, true);
  assert.strictEqual(m.overshoot, false);
});
test('overshooting 100 does not move', () => {
  const m = computeMove(97, 4); // would be 101
  assert.strictEqual(m.moved, false);
  assert.strictEqual(m.final, 97);
  assert.strictEqual(m.overshoot, true);
  assert.strictEqual(m.won, false);
});
test('dice 1..6 from square 94 behave correctly against exact rule', () => {
  assert.strictEqual(computeMove(94, 6).final, 100); // exact win
  assert.strictEqual(computeMove(94, 6).won, true);
  for (let d = 1; d <= 5; d++) {
    const m = computeMove(94, d);
    assert.strictEqual(m.moved, true);
    assert.strictEqual(m.won, false);
  }
  // From 95 (a snake head 95->75) a roll of 5 lands exactly on 100.
  assert.strictEqual(computeMove(95, 5).final, 100);
  // A roll landing on 95 itself triggers the snake.
  assert.strictEqual(computeMove(94, 1).final, 75);
});

console.log('GameState — turns, six-bonus, win');
test('two players alternate turns', () => {
  const g = new GameState([{ name: 'A', color: '#f00' }, { name: 'B', color: '#0f0' }]);
  assert.strictEqual(g.currentPlayer.name, 'A');
  g.takeTurn(2); g.advanceTurn();
  assert.strictEqual(g.currentPlayer.name, 'B');
  g.takeTurn(2); g.advanceTurn();
  assert.strictEqual(g.currentPlayer.name, 'A');
});
test('rolling a six grants the same player another turn', () => {
  const g = new GameState([{ name: 'A', color: '#f00' }, { name: 'B', color: '#0f0' }]);
  const res = g.takeTurn(6);
  assert.strictEqual(res.extraTurn, true);
  g.advanceTurn(); // should NOT change player because of extra turn
  assert.strictEqual(g.currentPlayer.name, 'A');
  g.takeTurn(2); // no six now
  g.advanceTurn();
  assert.strictEqual(g.currentPlayer.name, 'B');
});
test('a six on the winning move does NOT grant another turn', () => {
  const g = new GameState([{ name: 'A', color: '#f00' }, { name: 'B', color: '#0f0' }]);
  g.players[0].position = 94;
  const res = g.takeTurn(6); // 94+6 = 100 win
  assert.strictEqual(res.won, true);
  assert.strictEqual(res.extraTurn, false);
  assert.strictEqual(g.isOver, true);
  assert.strictEqual(g.winner.name, 'A');
});
test('overshoot passes the turn (no stuck state)', () => {
  const g = new GameState([{ name: 'A', color: '#f00' }, { name: 'B', color: '#0f0' }]);
  g.players[0].position = 98;
  const res = g.takeTurn(5); // overshoot
  assert.strictEqual(res.overshoot, true);
  assert.strictEqual(g.players[0].position, 98);
  g.advanceTurn();
  assert.strictEqual(g.currentPlayer.name, 'B');
});
test('overshoot with a six still grants another turn', () => {
  const g = new GameState([{ name: 'A', color: '#f00' }, { name: 'B', color: '#0f0' }]);
  g.players[0].position = 99;
  const res = g.takeTurn(6); // overshoot but rolled a six
  assert.strictEqual(res.overshoot, true);
  assert.strictEqual(res.extraTurn, true);
  g.advanceTurn();
  assert.strictEqual(g.currentPlayer.name, 'A');
});
test('no moves accepted after game is over', () => {
  const g = new GameState([{ name: 'A', color: '#f00' }, { name: 'B', color: '#0f0' }]);
  g.players[0].position = 97;
  g.takeTurn(3); // win
  const res = g.takeTurn(2);
  assert.strictEqual(res.error, 'game-over');
});
test('reset clears positions and winner, keeps players', () => {
  const g = new GameState([{ name: 'A', color: '#f00' }, { name: 'B', color: '#0f0' }]);
  g.players[0].position = 50; g.currentIndex = 1; g.winner = g.players[0];
  g.reset();
  assert.strictEqual(g.players[0].position, 0);
  assert.strictEqual(g.players[1].position, 0);
  assert.strictEqual(g.currentIndex, 0);
  assert.strictEqual(g.winner, null);
  assert.strictEqual(g.players.length, 2);
});
test('supports 4 players cycling correctly', () => {
  const g = new GameState([
    { name: 'A', color: '#1' }, { name: 'B', color: '#2' },
    { name: 'C', color: '#3' }, { name: 'D', color: '#4' },
  ]);
  const order = [];
  for (let i = 0; i < 8; i++) { order.push(g.currentPlayer.name); g.takeTurn(2); g.advanceTurn(); }
  assert.deepStrictEqual(order, ['A', 'B', 'C', 'D', 'A', 'B', 'C', 'D']);
});

console.log('\nFull playthrough simulation (seeded)');
test('a deterministic game eventually produces a valid winner', () => {
  // Linear congruential generator for reproducibility.
  let seed = 123456789;
  const rng = () => { seed = (1103515245 * seed + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const g = new GameState([{ name: 'A', color: '#f00' }, { name: 'B', color: '#0f0' }]);
  let guard = 0;
  while (!g.isOver && guard < 100000) {
    const roll = rollDie(rng);
    g.takeTurn(roll);
    g.players.forEach((p) => assert.ok(p.position >= 0 && p.position <= 100));
    if (!g.isOver) g.advanceTurn();
    guard++;
  }
  assert.ok(g.isOver, 'game should finish');
  assert.strictEqual(g.winner.position, 100);
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
