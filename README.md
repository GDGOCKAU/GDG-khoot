# GDG KAUHOOT

Live quiz game for GDG KAU, built with React + Vite. Its screens match the KAUHOOT prototype.

```
npm install
npm run dev
```

## Routes
| Path | Screen |
| --- | --- |
| `/` | Home: join with a PIN, explore quizzes, how it works |
| `/join/:quizId` | Choose your look (nickname + Devu mascot = team) |
| `/live` | Join the game this device is hosting |
| `/play` | Player screen for every phase, then game over + share |
| `/admin` | Admin sign in (demo password `gdgkau`) and dashboard |
| `/admin/new`, `/admin/edit/:quizId` | Quiz editor (choice, true/false, code, picture) |
| `/host/:quizId` | Host big screen: lobby, questions, results, podium |

## Code map
- `src/lib/engine.js`: game engine (phases, scoring, streaks, teams, practice players)
- `src/lib/store.js`: quizzes and stats in localStorage
- `src/components/game/Blocks.jsx`: answer chart, leaderboard, team podium, top 3, story card
- `src/pages/player/*`, `src/pages/admin/*`: the screens
- `src/styles.css`: all styles (light + dark)

This is a single-device demo: practice players join and answer by themselves.
A real-time backend can replace `engine.js` later.

The hanging spider mascot loads from `public/img/spider_mascot.png`. Add that file to show it.
