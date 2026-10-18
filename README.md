# 🐍 Snake & Ladder 🪜

A beautifully crafted, browser-based Snake & Ladder board game with a premium glassmorphic UI, smooth animations, and sound effects — all built with zero dependencies.

<p align="center">
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5" />
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3" />
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT License" />
</p>

---

## ✨ Features

- **2–4 Player Support** — Choose your player count and customize names & colors
- **Classic Board Layout** — Authentic 10×10 boustrophedon (zigzag) numbered board
- **Snakes & Ladders** — SVG-rendered connectors with wavy snakes and runged ladders
- **Animated Tokens** — Smooth CSS transitions with bounce easing and active-player bobbing
- **Dice with Physics** — Animated 3D-style rolling dice with pip-accurate faces
- **Sound Effects** — Web Audio API synthesized sounds (dice roll, move, ladder climb, snake bite, victory fanfare) — no audio files needed
- **Extra Turn on Six** — Roll a 6 and go again (classic rule)
- **Exact Roll to Win** — Must land exactly on square 100
- **Win Celebration** — Confetti animation and victory modal
- **Persistent Preferences** — Player names, colors, and mute setting saved to localStorage
- **Fully Responsive** — Adapts from mobile to widescreen
- **Keyboard Support** — Press `Space` or `Enter` to roll
- **Zero Dependencies** — Pure HTML, CSS, and vanilla JavaScript

## 🚀 Getting Started

### Play Instantly

Just open `index.html` in any modern browser — no build step, no server, no install.

```bash
# Clone the repo
git clone https://github.com/harsh-052005/snake-and-ladder.git
cd snake-and-ladder

# Open in your default browser
open index.html        # macOS
xdg-open index.html    # Linux
start index.html       # Windows
```

### Or serve locally

```bash
# Using Python
python3 -m http.server 8080

# Using Node
npx serve .
```

Then visit `http://localhost:8080`.

## 🎮 How to Play

1. **Setup** — Pick the number of players (2–4), enter names, and choose colors
2. **Roll** — Click **Roll Dice** (or press `Space` / `Enter`)
3. **Move** — Your token moves automatically; land on a ladder 🪜 to climb up, or a snake 🐍 to slide down
4. **Six = Extra Turn** — Roll a 6 and you get another roll
5. **Win** — Be the first to land **exactly** on square 100

## 🏗️ Project Structure

```
snake-and-ladder/
├── index.html          # Game markup (setup screen, board, sidebar, win modal)
├── style.css           # Premium dark glassmorphic theme & responsive layout
├── script.js           # Game logic (pure, testable) + UI layer (DOM, sound, animation)
├── tests/
│   └── logic.test.js   # Unit tests for pure game logic (runs in Node, no framework)
├── LICENSE             # MIT License
├── .gitignore
└── README.md
```

## 🧪 Running Tests

The game logic is fully decoupled from the DOM and tested with a lightweight, framework-free test harness:

```bash
node tests/logic.test.js
```

Tests cover:
- Dice rolling (range validation, injectable RNG)
- Zigzag board numbering (all 100 squares map uniquely)
- Snake/ladder transitions (every connector verified)
- Move computation (exact-roll-to-win, overshoot)
- Turn management (player cycling, six-bonus, game-over guard)
- Full seeded game simulation (deterministic playthrough)

## 🎨 Design Highlights

| Aspect | Detail |
|---|---|
| **Theme** | Dark mode with deep purple/navy gradients |
| **UI Style** | Glassmorphism — frosted panels with blur, transparency, and glow borders |
| **Board** | Warm checkerboard (gold/mint) with SVG-drawn snakes and ladder connectors |
| **Typography** | System font stack for fast rendering, weighted for hierarchy |
| **Animations** | CSS `cubic-bezier` token movement, dice spin keyframes, confetti rain, trophy bob |
| **Sound** | Procedurally generated via Web Audio API oscillators — no files to load |

## 🛠️ Tech Stack

- **HTML5** — Semantic markup with ARIA labels for accessibility
- **CSS3** — Custom properties, grid layout, `clamp()`, `backdrop-filter`, keyframe animations
- **JavaScript (ES6+)** — Classes, async/await, Web Audio API, localStorage
- **SVG** — Procedurally generated snake/ladder overlays
- **No frameworks, no bundlers, no dependencies**

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<p align="center">
  Made with ❤️ — Roll the dice and have fun!
</p>
