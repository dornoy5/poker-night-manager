# 🃏 Poker Night Manager

A mobile-first React web app to manage poker home games — track buy-ins, rebuys, chip values, and automatically calculate who owes whom at the end of the night.

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

## ✨ Features

- **Game Setup** — Set buy-in amount, chips per buy-in, currency (₪/$/€), and add players
- **Chip Value System** — Define how many chips each player gets per buy-in; the app calculates chip value automatically
- **Live Game Dashboard** — Track all players, their buy-ins, and rebuys in real time
- **Flexible Rebuys** — Quick rebuy buttons in multiples of 50
- **Mid-Game Join/Leave** — Add new players or cash out players during the game
- **Chip-Based Cashout** — Players enter their final chip count and the app converts to money
- **Auto Settlement** — Calculates the minimum number of money transfers needed to settle all debts
- **Transfer Instructions** — Clear per-person instructions showing who to pay and who to collect from
- **Game Summary** — Final standings, biggest winner/loser, and stats
- **Mobile-First Design** — Optimized for use at the poker table on your phone
- **Dark Poker Theme** — Immersive green felt aesthetic with gold accents

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation
```bash
git clone https://github.com/dornoy5/poker-night-manager.git
cd poker-night-manager
npm install
```

### Run Development Server
```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

### Build for Production
```bash
npm run build
npm run preview
```

## 🎮 How to Use

1. **Setup** — Choose currency, set buy-in amount and chips per buy-in, add all players
2. **Play** — During the game, use the dashboard to add rebuys or cash out players who leave early
3. **End Game** — Click "End Game" and enter each remaining player's final chip count
4. **Settle Up** — The app shows clear transfer instructions for each player

### Example

- Buy-in: ₪100 → 200 chips (chip value = ₪0.50)
- At the end, a player with 500 chips has ₪250
- The app calculates: "Dor, transfer ₪150 to Omer"

## 🛠 Tech Stack

- **React 18** — Functional components with hooks (`useState`, `useReducer`, `useContext`, `useMemo`)
- **Vite** — Fast build tool and dev server
- **CSS** — Custom CSS with CSS variables, no UI libraries
- **State Management** — `useReducer` + Context API (no external state libraries)

## 📁 Project Structure
```
poker-night-manager/
├── src/
│   ├── components/
│   │   ├── SetupScreen.jsx       # Game config, players & chip setup
│   │   ├── GameScreen.jsx        # Active game dashboard
│   │   ├── CashoutScreen.jsx     # End-game chip count entry
│   │   └── SettlementScreen.jsx  # Results & transfer instructions
│   ├── context/
│   │   └── GameContext.jsx       # Global state with useReducer
│   ├── utils/
│   │   └── helpers.js            # Settlement algorithm & utilities
│   ├── App.jsx                   # Main app with phase routing
│   ├── main.jsx                  # Entry point
│   └── index.css                 # Global styles & poker theme
├── index.html
├── vite.config.js
└── package.json
```

## 💡 Settlement Algorithm

The app uses a greedy algorithm to minimize the number of money transfers:

1. Calculate each player's **net** (cash-out minus total buy-in)
2. Separate into **debtors** (lost money) and **creditors** (won money)
3. Match the largest debtor with the largest creditor
4. Repeat until all debts are settled

This ensures the fewest possible transactions — no circular payments.

## 📄 License

MIT
```

**Step 2:** Make sure you have a `.gitignore` file in the root folder. If not, create one and paste:
```
node_modules/
dist/
.env
.env.local
.DS_Store
*.log