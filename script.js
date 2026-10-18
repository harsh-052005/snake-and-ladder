/* =========================================================
   Snake & Ladder — Game Logic + UI
   ---------------------------------------------------------
   Architecture:
   - GameLogic: pure functions + a GameState class (no DOM).
     Fully unit-testable in Node.
   - UI layer: renders GameState to the DOM, handles input,
     plays sounds, and animates.
   The two are decoupled: UI calls logic methods, then re-renders.
   ========================================================= */

/* =========================================================
   1. GAME LOGIC (pure, no DOM / no window)
   ========================================================= */

// Classic Snake & Ladder board definition.
// Keys are the START square, values are the DESTINATION square.
// Ladders go up (value > key); snakes go down (value < key).
const SNAKES = {
  16: 6,
  47: 26,
  49: 11,
  56: 53,
  62: 19,
  64: 60,
  87: 24,
  93: 73,
  95: 75,
  98: 78,
};

const LADDERS = {
  1: 38,
  4: 14,
  9: 31,
  21: 42,
  28: 84,
  36: 44,
  51: 67,
  71: 91,
  80: 100,
};

const BOARD_SIZE = 100;

/**
 * Roll a single six-sided die.
 * @param {() => number} [rng] - injectable RNG (returns 0..1) for testing.
 * @returns {number} 1..6
 */
function rollDie(rng = Math.random) {
  return Math.floor(rng() * 6) + 1;
}

/**
 * Given a raw landing square, apply any snake or ladder transition.
 * @param {number} square
 * @returns {{ square: number, type: 'ladder'|'snake'|null, from: number }}
 */
function applyTransition(square) {
  if (LADDERS[square] !== undefined) {
    return { square: LADDERS[square], type: 'ladder', from: square };
  }
  if (SNAKES[square] !== undefined) {
    return { square: SNAKES[square], type: 'snake', from: square };
  }
  return { square, type: null, from: square };
}

/**
 * Compute the result of a move WITHOUT mutating state.
 * Implements the "exact roll to win" rule: if the roll would
 * overshoot 100, the player does not move.
 *
 * @param {number} currentPos
 * @param {number} roll 1..6
 * @returns {{
 *   moved: boolean,
 *   landed: number,      // square after the dice move (pre-transition)
 *   final: number,       // square after snake/ladder transition
 *   transition: 'ladder'|'snake'|null,
 *   won: boolean,
 *   overshoot: boolean
 * }}
 */
function computeMove(currentPos, roll) {
  const target = currentPos + roll;

  // Exact-roll rule: overshooting 100 is not allowed.
  if (target > BOARD_SIZE) {
    return {
      moved: false,
      landed: currentPos,
      final: currentPos,
      transition: null,
      won: false,
      overshoot: true,
    };
  }

  const t = applyTransition(target);
  return {
    moved: true,
    landed: target,
    final: t.square,
    transition: t.type,
    won: t.square === BOARD_SIZE,
    overshoot: false,
  };
}

/**
 * Convert a 1..100 square number to a {row, col} grid position
 * using the classic boustrophedon (zigzag) numbering, where
 * square 1 is bottom-left and numbering snakes upward.
 * row 0 = top of the board, row 9 = bottom.
 * @param {number} square 1..100
 * @returns {{row: number, col: number}}
 */
function squareToRowCol(square) {
  const index = square - 1;
  const rowFromBottom = Math.floor(index / 10);
  const row = 9 - rowFromBottom; // flip so row 0 is top
  let col = index % 10;
  // Odd rows (from bottom) go right-to-left.
  if (rowFromBottom % 2 === 1) {
    col = 9 - col;
  }
  return { row, col };
}

/**
 * Game state container. Holds players, turn order, and win status.
 * Pure logic — never touches the DOM.
 */
class GameState {
  /**
   * @param {Array<{name: string, color: string}>} players
   */
  constructor(players) {
    this.players = players.map((p, i) => ({
      id: i,
      name: p.name,
      color: p.color,
      position: 0, // 0 == off board / start
    }));
    this.currentIndex = 0;
    this.winner = null;
    this.extraTurn = false; // set when a six is rolled
  }

  get currentPlayer() {
    return this.players[this.currentIndex];
  }

  get isOver() {
    return this.winner !== null;
  }

  /**
   * Advance to the next player's turn, honouring the six-roll bonus.
   */
  advanceTurn() {
    if (this.isOver) return;
    if (this.extraTurn) {
      this.extraTurn = false; // same player rolls again
      return;
    }
    this.currentIndex = (this.currentIndex + 1) % this.players.length;
  }

  /**
   * Apply a dice roll to the current player and update state.
   * Returns a rich result object the UI can narrate/animate.
   *
   * @param {number} roll 1..6
   * @returns {object} move result + metadata
   */
  takeTurn(roll) {
    if (this.isOver) {
      return { error: 'game-over' };
    }
    const player = this.currentPlayer;
    const result = computeMove(player.position, roll);
    const rolledSix = roll === 6;

    if (result.moved) {
      player.position = result.final;
    }

    if (result.won) {
      this.winner = player;
      this.extraTurn = false;
    } else {
      // A six grants another turn (only if the game continues).
      this.extraTurn = rolledSix;
    }

    return {
      ...result,
      roll,
      rolledSix,
      player: { id: player.id, name: player.name, color: player.color },
      landedOnSquare: result.landed,
      extraTurn: this.extraTurn,
    };
  }

  /**
   * Reset positions/turn but keep the same players (Restart / Play again).
   */
  reset() {
    this.players.forEach((p) => (p.position = 0));
    this.currentIndex = 0;
    this.winner = null;
    this.extraTurn = false;
  }
}

// Export for Node-based unit tests (no effect in the browser).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SNAKES,
    LADDERS,
    BOARD_SIZE,
    rollDie,
    applyTransition,
    computeMove,
    squareToRowCol,
    GameState,
  };
}

/* =========================================================
   2. UI LAYER (browser only)
   ========================================================= */
// Guard so this whole block is skipped under Node (during tests).
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    // ---------- Constants ----------
    const COLORS = [
      { name: 'Coral', value: '#ff5e7e' },
      { name: 'Gold', value: '#ffb84d' },
      { name: 'Mint', value: '#3ddc97' },
      { name: 'Sky', value: '#4da6ff' },
      { name: 'Violet', value: '#b06bff' },
      { name: 'Rose', value: '#ff8fd0' },
    ];
    const STORAGE_KEY = 'snl-prefs-v1';

    // ---------- Element refs ----------
    const el = (id) => document.getElementById(id);
    const setupScreen = el('setup-screen');
    const gameScreen = el('game-screen');
    const countButtons = el('count-buttons');
    const playersSetup = el('players-setup');
    const startBtn = el('start-btn');
    const boardEl = el('board');
    const overlay = el('overlay');
    const tokensLayer = el('tokens-layer');
    const diceEl = el('dice');
    const rollBtn = el('roll-btn');
    const messageEl = el('message');
    const currentPlayerEl = el('current-player');
    const scoreboardEl = el('scoreboard');
    const logEl = el('log');
    const muteBtn = el('mute-btn');
    const newGameBtn = el('new-game-btn');
    const restartBtn = el('restart-btn');
    const winModal = el('win-modal');
    const winnerNameEl = el('winner-name');
    const confettiEl = el('confetti');
    const playAgainBtn = el('play-again-btn');
    const winNewGameBtn = el('win-new-game-btn');

    // ---------- UI state ----------
    let playerCount = 3;
    let selectedColors = []; // color value per player index
    let game = null;         // GameState instance
    let muted = false;
    let busy = false;        // true while an animation/turn is resolving

    /* =====================================================
       SOUND (Web Audio API — no external files needed)
       ===================================================== */
    const Sound = (() => {
      let ctx = null;
      function ensure() {
        if (ctx) return ctx;
        try {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (!AudioCtx) return null;
          ctx = new AudioCtx();
        } catch (e) {
          ctx = null; // audio unavailable — game must still work
        }
        return ctx;
      }
      function tone(freq, duration, type = 'sine', gainVal = 0.08, when = 0) {
        if (muted) return;
        const c = ensure();
        if (!c) return;
        try {
          const osc = c.createOscillator();
          const gain = c.createGain();
          osc.type = type;
          osc.frequency.setValueAtTime(freq, c.currentTime + when);
          gain.gain.setValueAtTime(gainVal, c.currentTime + when);
          gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + when + duration);
          osc.connect(gain).connect(c.destination);
          osc.start(c.currentTime + when);
          osc.stop(c.currentTime + when + duration);
        } catch (e) { /* ignore — keep game usable */ }
      }
      return {
        dice() { for (let i = 0; i < 4; i++) tone(180 + Math.random() * 120, 0.08, 'square', 0.05, i * 0.06); },
        move() { tone(420, 0.09, 'triangle', 0.06); },
        ladder() { [392, 523, 659, 784].forEach((f, i) => tone(f, 0.16, 'sine', 0.07, i * 0.09)); },
        snake() { [500, 380, 280, 180].forEach((f, i) => tone(f, 0.18, 'sawtooth', 0.06, i * 0.09)); },
        win() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.25, 'sine', 0.08, i * 0.14)); },
        resume() { const c = ensure(); if (c && c.state === 'suspended') c.resume(); },
      };
    })();

    /* =====================================================
       SETUP SCREEN
       ===================================================== */
    function loadPrefs() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
      } catch (e) { return null; }
    }
    function savePrefs() {
      try {
        const names = [...playersSetup.querySelectorAll('.p-name')].map((i) => i.value);
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          playerCount, names, colors: selectedColors, muted,
        }));
      } catch (e) { /* storage may be unavailable — ignore */ }
    }

    function defaultColorFor(index) {
      // Pick the first color not already used by earlier players.
      const used = selectedColors.slice(0, index);
      const free = COLORS.find((c) => !used.includes(c.value));
      return (free || COLORS[index % COLORS.length]).value;
    }

    function renderSetup(prefs) {
      // Count buttons active state
      [...countButtons.children].forEach((b) => {
        b.classList.toggle('active', Number(b.dataset.count) === playerCount);
      });

      // Ensure a color is chosen for each player slot.
      selectedColors = [];
      for (let i = 0; i < playerCount; i++) {
        const fromPrefs = prefs && prefs.colors && prefs.colors[i];
        selectedColors[i] = fromPrefs || defaultColorFor(i);
      }

      playersSetup.innerHTML = '';
      for (let i = 0; i < playerCount; i++) {
        const row = document.createElement('div');
        row.className = 'player-row';

        const swatch = document.createElement('span');
        swatch.className = 'swatch';
        swatch.style.background = selectedColors[i];

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'p-name';
        input.maxLength = 14;
        input.placeholder = `Player ${i + 1}`;
        input.value = (prefs && prefs.names && prefs.names[i]) || '';

        const picker = document.createElement('div');
        picker.className = 'color-picker';
        COLORS.forEach((c) => {
          const dot = document.createElement('span');
          dot.className = 'color-dot' + (c.value === selectedColors[i] ? ' selected' : '');
          dot.style.background = c.value;
          dot.title = c.name;
          dot.addEventListener('click', () => {
            // Prevent two players sharing a color.
            if (selectedColors.includes(c.value) && selectedColors[i] !== c.value) return;
            selectedColors[i] = c.value;
            swatch.style.background = c.value;
            [...picker.children].forEach((d, di) => d.classList.toggle('selected', COLORS[di].value === c.value));
          });
          picker.appendChild(dot);
        });

        row.append(swatch, input, picker);
        playersSetup.appendChild(row);
      }
    }

    countButtons.addEventListener('click', (e) => {
      const btn = e.target.closest('.count-btn');
      if (!btn) return;
      playerCount = Number(btn.dataset.count);
      renderSetup();
    });

    startBtn.addEventListener('click', () => {
      Sound.resume();
      const names = [...playersSetup.querySelectorAll('.p-name')].map((inp, i) =>
        inp.value.trim() || `Player ${i + 1}`);
      const players = names.map((name, i) => ({ name, color: selectedColors[i] }));
      savePrefs();
      startGame(players);
    });

    /* =====================================================
       BOARD RENDERING
       ===================================================== */
    function buildBoard() {
      boardEl.innerHTML = '';
      // Render cells row by row (row 0 = top). Number them per zigzag map.
      // We create a lookup from row,col -> square to place numbers.
      const grid = {};
      for (let sq = 1; sq <= BOARD_SIZE; sq++) {
        const { row, col } = squareToRowCol(sq);
        grid[`${row},${col}`] = sq;
      }
      for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
          const sq = grid[`${row},${col}`];
          const cell = document.createElement('div');
          cell.className = 'cell ' + ((row + col) % 2 === 0 ? 'light' : 'dark');
          cell.dataset.square = sq;

          const num = document.createElement('span');
          num.className = 'num';
          num.textContent = sq;
          cell.appendChild(num);

          if (LADDERS[sq] !== undefined) {
            cell.classList.add('ladder-cell');
            const icon = document.createElement('span');
            icon.className = 'icon';
            icon.textContent = '🪜';
            cell.appendChild(icon);
          } else if (SNAKES[sq] !== undefined) {
            cell.classList.add('snake-cell');
            const icon = document.createElement('span');
            icon.className = 'icon';
            icon.textContent = '🐍';
            cell.appendChild(icon);
          }
          boardEl.appendChild(cell);
        }
      }
      drawOverlay();
    }

    // Center coordinate (in %) of a square for SVG lines & tokens.
    function squareCenterPct(square) {
      const { row, col } = squareToRowCol(square);
      return {
        x: (col + 0.5) * 10,
        y: (row + 0.5) * 10,
      };
    }

    function drawOverlay() {
      overlay.setAttribute('viewBox', '0 0 100 100');
      overlay.innerHTML = '';
      const ns = 'http://www.w3.org/2000/svg';

      const drawConnector = (from, to, color) => {
        const a = squareCenterPct(from);
        const b = squareCenterPct(to);
        // Two parallel rails for a ladder / a wavy body for a snake.
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len; // normal
        const ny = dx / len;

        if (color === 'ladder') {
          const off = 1.6;
          for (const s of [-off, off]) {
            const line = document.createElementNS(ns, 'line');
            line.setAttribute('x1', a.x + nx * s);
            line.setAttribute('y1', a.y + ny * s);
            line.setAttribute('x2', b.x + nx * s);
            line.setAttribute('y2', b.y + ny * s);
            line.setAttribute('stroke', '#2a8a5f');
            line.setAttribute('stroke-width', '0.9');
            line.setAttribute('stroke-linecap', 'round');
            overlay.appendChild(line);
          }
          // rungs
          const rungs = Math.max(3, Math.round(len / 7));
          for (let i = 1; i < rungs; i++) {
            const t = i / rungs;
            const px = a.x + dx * t;
            const py = a.y + dy * t;
            const rung = document.createElementNS(ns, 'line');
            rung.setAttribute('x1', px + nx * off);
            rung.setAttribute('y1', py + ny * off);
            rung.setAttribute('x2', px - nx * off);
            rung.setAttribute('y2', py - ny * off);
            rung.setAttribute('stroke', '#3ddc97');
            rung.setAttribute('stroke-width', '0.7');
            rung.setAttribute('stroke-linecap', 'round');
            overlay.appendChild(rung);
          }
        } else {
          // Snake: a thick wavy path from head (from) to tail (to).
          const path = document.createElementNS(ns, 'path');
          const mx1 = a.x + dx * 0.33 + nx * 4;
          const my1 = a.y + dy * 0.33 + ny * 4;
          const mx2 = a.x + dx * 0.66 - nx * 4;
          const my2 = a.y + dy * 0.66 - ny * 4;
          path.setAttribute('d', `M ${a.x} ${a.y} C ${mx1} ${my1}, ${mx2} ${my2}, ${b.x} ${b.y}`);
          path.setAttribute('fill', 'none');
          path.setAttribute('stroke', '#ff5e7e');
          path.setAttribute('stroke-width', '2.2');
          path.setAttribute('stroke-linecap', 'round');
          path.setAttribute('opacity', '0.85');
          overlay.appendChild(path);
          // snake head marker
          const head = document.createElementNS(ns, 'circle');
          head.setAttribute('cx', a.x);
          head.setAttribute('cy', a.y);
          head.setAttribute('r', '1.8');
          head.setAttribute('fill', '#ff2d55');
          overlay.appendChild(head);
        }
      };

      Object.entries(LADDERS).forEach(([from, to]) => drawConnector(Number(from), to, 'ladder'));
      Object.entries(SNAKES).forEach(([from, to]) => drawConnector(Number(from), to, 'snake'));
    }

    /* =====================================================
       TOKENS
       ===================================================== */
    function buildTokens() {
      tokensLayer.innerHTML = '';
      game.players.forEach((p) => {
        const token = document.createElement('div');
        token.className = 'token';
        token.id = `token-${p.id}`;
        token.style.background = p.color;
        token.textContent = p.name.charAt(0).toUpperCase();
        tokensLayer.appendChild(token);
      });
      positionAllTokens();
    }

    // Place every token; offset tokens that share a square so none overlap.
    function positionAllTokens() {
      const bySquare = {};
      game.players.forEach((p) => {
        const key = p.position;
        (bySquare[key] = bySquare[key] || []).push(p);
      });

      game.players.forEach((p) => {
        const token = document.getElementById(`token-${p.id}`);
        if (!token) return;
        token.classList.toggle('active', p.id === game.currentPlayer.id && !game.isOver);

        if (p.position === 0) {
          // Rest off-board tokens below square 1 (bottom-left) spread out.
          const group = bySquare[0];
          const idx = group.indexOf(p);
          token.style.left = `${6 + idx * 7}%`;
          token.style.top = '96%';
          token.style.opacity = '0.85';
          return;
        }
        token.style.opacity = '1';
        const center = squareCenterPct(p.position);
        const group = bySquare[p.position];
        const idx = group.indexOf(p);
        const n = group.length;
        // Spread tokens in a small cluster inside the cell.
        const spread = 2.2;
        const angle = (idx / Math.max(1, n)) * Math.PI * 2;
        const ox = n > 1 ? Math.cos(angle) * spread : 0;
        const oy = n > 1 ? Math.sin(angle) * spread : 0;
        token.style.left = `${center.x + ox}%`;
        token.style.top = `${center.y + oy}%`;
      });
    }

    /* =====================================================
       SCOREBOARD + LOG + MESSAGES
       ===================================================== */
    function renderScoreboard() {
      const leadPos = Math.max(...game.players.map((p) => p.position));
      scoreboardEl.innerHTML = '';
      game.players.forEach((p) => {
        const li = document.createElement('li');
        li.className = 'score-item';
        if (p.position === leadPos && leadPos > 0) li.classList.add('leading');
        if (p.id === game.currentPlayer.id && !game.isOver) li.classList.add('current');
        li.innerHTML = `
          <span class="s-dot" style="background:${p.color}"></span>
          <span class="s-name">${escapeHtml(p.name)}</span>
          <span class="s-pos">${p.position}</span>`;
        scoreboardEl.appendChild(li);
      });
    }

    function renderCurrentPlayer() {
      const p = game.currentPlayer;
      currentPlayerEl.innerHTML = `
        <span class="dot" style="background:${p.color}"></span>
        <span class="name">${escapeHtml(p.name)}</span>`;
    }

    function addLog(text, type = '') {
      const li = document.createElement('li');
      if (type) li.className = type;
      li.textContent = text;
      logEl.prepend(li);
      // Keep log tidy.
      while (logEl.children.length > 40) logEl.removeChild(logEl.lastChild);
    }

    function setMessage(text, type = '') {
      messageEl.textContent = text;
      messageEl.className = 'message' + (type ? ' ' + type : '');
    }

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
      }[c]));
    }

    /* =====================================================
       DICE RENDERING
       ===================================================== */
    const PIP_LAYOUTS = {
      1: [4],
      2: [0, 8],
      3: [0, 4, 8],
      4: [0, 2, 6, 8],
      5: [0, 2, 4, 6, 8],
      6: [0, 2, 3, 5, 6, 8],
    };
    function renderDice(value) {
      const face = document.createElement('div');
      face.className = 'pip-face';
      const positions = PIP_LAYOUTS[value] || [];
      for (let i = 0; i < 9; i++) {
        const cell = document.createElement('span');
        if (!positions.includes(i)) cell.style.visibility = 'hidden';
        face.appendChild(cell);
      }
      diceEl.innerHTML = '';
      diceEl.appendChild(face);
    }

    /* =====================================================
       TURN FLOW
       ===================================================== */
    async function handleRoll() {
      if (busy || game.isOver) return;
      busy = true;
      rollBtn.disabled = true;

      Sound.resume();
      Sound.dice();
      diceEl.classList.add('rolling');

      // Quick shuffle animation on the die face.
      const shuffle = setInterval(() => renderDice(rollDie()), 70);
      await wait(600);
      clearInterval(shuffle);
      diceEl.classList.remove('rolling');

      const roll = rollDie();
      renderDice(roll);

      const player = game.currentPlayer;
      const result = game.takeTurn(roll);

      addLog(`${player.name} rolled a ${roll}.`);

      if (result.overshoot) {
        setMessage(`Need exactly ${BOARD_SIZE - player.position} to win — roll again!`, 'info');
        addLog(`${player.name} overshot ${BOARD_SIZE}. Turn passes.`);
      } else {
        // Animate the base move first.
        positionAllTokens();
        Sound.move();
        await wait(380);

        if (result.transition === 'ladder') {
          setMessage('🪜 You climbed a ladder!', 'ladder');
          addLog(`${player.name} climbed a ladder: ${result.landedOnSquare} → ${result.final}.`, 'ladder');
          Sound.ladder();
          positionAllTokens(); // token already at final; re-cluster
          await wait(420);
        } else if (result.transition === 'snake') {
          setMessage('🐍 Oops! You got bitten by a snake!', 'snake');
          addLog(`${player.name} was bitten by a snake: ${result.landedOnSquare} → ${result.final}.`, 'snake');
          Sound.snake();
          positionAllTokens();
          await wait(420);
        } else {
          setMessage(`${player.name} moved to ${result.final}.`);
        }
      }

      renderScoreboard();

      if (result.won) {
        onWin(player);
        busy = false;
        return;
      }

      if (result.extraTurn) {
        setMessage(`🎉 ${player.name} rolled a 6 — roll again!`, 'info');
        addLog(`${player.name} rolled a 6 and gets another turn.`);
      }

      // Advance turn (no-op if extra turn) and refresh UI.
      game.advanceTurn();
      renderCurrentPlayer();
      renderScoreboard();
      positionAllTokens();

      busy = false;
      rollBtn.disabled = game.isOver;
    }

    /* =====================================================
       WIN HANDLING
       ===================================================== */
    function onWin(player) {
      setMessage(`🏆 ${player.name} wins!`, 'info');
      addLog(`🏆 ${player.name} reached 100 and won the game!`, 'win');
      Sound.win();
      rollBtn.disabled = true;
      positionAllTokens();
      winnerNameEl.textContent = player.name;
      winnerNameEl.style.color = player.color;
      launchConfetti();
      winModal.classList.remove('hidden');
    }

    function launchConfetti() {
      confettiEl.innerHTML = '';
      const colors = ['#ff5e7e', '#ffb84d', '#3ddc97', '#4da6ff', '#b06bff', '#ff8fd0'];
      for (let i = 0; i < 90; i++) {
        const piece = document.createElement('i');
        piece.style.left = Math.random() * 100 + '%';
        piece.style.background = colors[i % colors.length];
        piece.style.animationDuration = 2 + Math.random() * 2.5 + 's';
        piece.style.animationDelay = Math.random() * 0.8 + 's';
        piece.style.transform = `rotate(${Math.random() * 360}deg)`;
        confettiEl.appendChild(piece);
      }
    }

    /* =====================================================
       GAME LIFECYCLE
       ===================================================== */
    function startGame(players) {
      game = new GameState(players);
      setupScreen.classList.add('hidden');
      gameScreen.classList.remove('hidden');
      winModal.classList.add('hidden');
      logEl.innerHTML = '';
      buildBoard();
      buildTokens();
      renderDice(1);
      renderCurrentPlayer();
      renderScoreboard();
      setMessage(`${game.currentPlayer.name}, roll to begin!`, 'info');
      addLog('New game started. Good luck!');
      rollBtn.disabled = false;
      busy = false;
    }

    function restartGame() {
      if (!game) return;
      game.reset();
      winModal.classList.add('hidden');
      confettiEl.innerHTML = '';
      logEl.innerHTML = '';
      renderDice(1);
      renderCurrentPlayer();
      renderScoreboard();
      positionAllTokens();
      setMessage(`${game.currentPlayer.name}, roll to begin!`, 'info');
      addLog('Game restarted.');
      rollBtn.disabled = false;
      busy = false;
    }

    function backToSetup() {
      winModal.classList.add('hidden');
      confettiEl.innerHTML = '';
      gameScreen.classList.add('hidden');
      setupScreen.classList.remove('hidden');
    }

    /* =====================================================
       EVENT BINDINGS
       ===================================================== */
    rollBtn.addEventListener('click', handleRoll);
    restartBtn.addEventListener('click', restartGame);
    newGameBtn.addEventListener('click', backToSetup);
    playAgainBtn.addEventListener('click', restartGame);
    winNewGameBtn.addEventListener('click', backToSetup);

    muteBtn.addEventListener('click', () => {
      muted = !muted;
      muteBtn.textContent = muted ? '🔇' : '🔊';
      savePrefs();
    });

    // Keyboard shortcut: Space / Enter to roll.
    document.addEventListener('keydown', (e) => {
      const gameVisible = !gameScreen.classList.contains('hidden');
      const winVisible = !winModal.classList.contains('hidden');
      if ((e.code === 'Space' || e.code === 'Enter') && gameVisible && !winVisible) {
        if (!rollBtn.disabled && !busy) { e.preventDefault(); handleRoll(); }
      }
    });

    // Re-cluster tokens if the board resizes (percent-based, but keeps active bob correct).
    window.addEventListener('resize', () => { if (game) positionAllTokens(); });

    // ---------- Utility ----------
    function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

    /* =====================================================
       INIT
       ===================================================== */
    const prefs = loadPrefs();
    if (prefs) {
      if (prefs.playerCount) playerCount = prefs.playerCount;
      if (typeof prefs.muted === 'boolean') { muted = prefs.muted; muteBtn.textContent = muted ? '🔇' : '🔊'; }
    }
    renderSetup(prefs);
  });
}
