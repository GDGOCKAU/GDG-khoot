# GDG KAUHOOT — Back-end Handoff

> Transcribed from the front-end author's handoff doc (dated 18 Nov 2026).
> NOTE: this doc describes an older vanilla-JS version of the front end (`index.html`, `app.js`).
> The repo is now React + Vite. Use this file for **behavior, data rules and game flow**, not for file or function names.

## Overview

The front end is finished and runs entirely in one browser today; the back end replaces three fake parts: local storage, the practice bots, and the hard-coded admin password.

- **Live site:** GDG KAUHOOT (vanilla JS, no framework: `index.html`, `app.js`, `styles.css`, `img/`).
- **Storage today:** everything sits in `localStorage` under the key `kauhoot.v2` (quizzes, custom topics, game history). Nothing is shared between devices.
- **Players today:** 11 bots join and answer on a timer so one person can test a full game. Real players must replace them.
- **Admin today:** one shared password (`gdgkau`) checked in the browser, kept in `sessionStorage`. The club keeps one shared password, but the check must move to the server.

What the back end needs to add: saved quizzes for admins, a 6-digit game PIN players join with, live sync of the game between the host screen and every player phone, and server-side scoring.

## Data model

Three things get stored: quizzes (each holding its questions), custom topics, and finished-game records. The shapes below are exactly what the front end reads and writes now.

### Quiz

| Field | Type | Notes |
|---|---|---|
| `id` | string | 8-char random id today; any unique id works |
| `title` | string | max 60 chars |
| `topic` | string | a built-in topic or a custom topic name |
| `desc` | string | max 90 chars |
| `status` | `'draft'` or `'ready'` | only `ready` quizzes show on the home page |
| `pin` | string | 6 digits, used for practice games |
| `lastHosted` | timestamp or null | set when a hosted game ends |
| `questions` | Question[] | at least 1 |

### Question (all types)

| Field | Type | Used by | Notes |
|---|---|---|---|
| `type` | `'mc'`, `'tf'`, `'code'`, `'pic'` | all | missing means `mc` (older data) |
| `text` | string | all | max 160 chars |
| `time` | number | all | seconds: 5, 10, 15, 20, 30 or 60 |
| `points` | 0, 1 or 2 | all | 0 = no points, 2 = double |
| `answers` | string[4] | mc, tf, code | empty strings for unused slots; tf is always `['True','False','','']` |
| `correct` | number | mc, tf, code | index into `answers`; -1 = not set |
| `img` | data URL or null | mc, tf | optional picture, resized to max 800 px JPEG |
| `code` | string | code | the snippet shown on the host screen |
| `lang` | string | code | Dart, Python, JavaScript, Kotlin, Java, C++, Go or SQL |
| `pics` | string[] | pic | 2 or more images, left to right; max 400 px JPEG data URLs |
| `word` | string | pic | the answer, uppercase letters, digits and spaces, max 20 |

A question is valid when: it has text; for `pic`, at least 2 pictures and a word; for `tf`, `correct` is 0 or 1; for `code`, the code is not empty; for `mc` and `code`, at least 2 answers and `correct` points at a filled one. Invalid questions are skipped when a game starts. Images are inline data URLs today; the back end should probably store them as files and save URLs instead.

### Custom topic

`{ name: string, c: 'blue' | 'red' | 'yellow' | 'green' }`. Built-in topics are Mobile, Cloud, AI, Web and Other. The colour rotates through the four Google colours.

### Game record (one per finished game)

`{ quizId, mode: 'host' | 'player', players: number, accuracy: 0-1, at: timestamp }`. Used for the dashboard counts: games hosted, total players, average accuracy.

## Game flow

The server should own one phase at a time with an end time; every screen just shows the current phase.

Every question runs the same loop until the last one (phase durations on a hosted game):

```
Lobby (until host starts)
  -> Get ready (3 s countdown)
  -> Question (time limit)
  -> Reveal (5.5 s)
  -> Leaderboard (7 s, host only)
  -> Last question?
       no  -> Next question (3 s countdown) -> Question ...
       yes -> Team results (8 s) -> Top 3 (9 s) -> Final ranking (stays open)
```

- During **Question**, players answer; it ends at the time limit or as soon as everyone has answered.
- During **Reveal**, each player sees right / wrong / time's up with their points, and the host screen shows how many picked each answer (for Picture: got it / wrong guess / no answer).
- The **Leaderboard** after each question shows on the host screen only. Players stay on their result screen, which tells them to look at the big screen; their own rank comes in the `result` event.
- **Team results**, **Top 3** and **Final ranking** show on every screen. Each phone marks the player's own team ("Your team") and own row ("You"), and the Top 3 screen adds a card with the player's final place and points.
- Practice games skip the lobby and add a 4.5 s answer chart between Reveal (3.5 s there) and Leaderboard.
- The host can press Skip to end any timed phase early, or end the game at any point.

## Scoring and answer checking

A correct answer earns between 500 and 1,000 points depending on speed, times the question's points value, plus a streak bonus. Wrong or no answer earns 0 and resets the streak.

```
points = round( 1000 * (1 - min(t, T) / (2T)) ) * p  +  100 * min(s - 1, 5)
```

- `t` = milliseconds from the question opening to the answer; `T` = the time limit in ms.
- `p` = the question's `points` (0, 1 or 2). When `p` is 0 the player earns nothing, not even the streak bonus.
- `s` = the player's streak including this answer, so the bonus starts at the 2nd correct in a row and caps at +500.

How an answer is checked:

| Type | Player sends | Correct when |
|---|---|---|
| `mc`, `code` | answer index 0-3 | index equals `correct` |
| `tf` | 0 (True) or 1 (False) | index equals `correct` |
| `pic` | the typed word | both sides match after uppercasing and removing everything except A-Z and 0-9 (`doorman` = `DOORMAN`; `DOOR MAN` also counts) |

One answer per player per question; the first one counts. The question closes early once every player has answered.

Teams: each player picks one of four teams (blue, red, yellow, green) when joining. A team's score is the **average** points of its players, so team size doesn't decide the winner. Game accuracy for the dashboard = total correct answers ÷ (players × questions).

Timing should be measured on the server (question open time vs answer arrival). Trusting the phone's clock would let players cheat.

## What the back end needs to provide

Four pieces: admin sign-in, quiz storage, live game rooms, and game history. Live rooms are the hard part; the rest is plain CRUD.

1. **Admin sign-in**: the shared password stays, but move the check to the server: store only its hash, and give admins a session token after sign-in. Only signed-in admins can create, edit, delete or host.
2. **Quiz storage**: create, read, update and delete quizzes and custom topics, using the shapes above. The editor autosaves about 0.5 s after each change, so saving should accept frequent small writes. Image upload for `img` and `pics`.
3. **Live game rooms** (needs WebSockets or something like Firebase Realtime Database / Firestore listeners):
    - Host starts a game, gets a fresh 6-digit PIN.
    - Players join with PIN + nickname + team + mascot. Nicknames must be unique in the room (not case-sensitive). Host can lock the room.
    - The server owns the phase and its end time and pushes every phase change to all screens.
    - Players send answers; the server checks them, scores them and sends results back.
    - Host can skip the timer, and can end the game. If the host leaves, players are told the game was closed.
4. **Game history**: save a record when a game ends, and set the quiz's `lastHosted`. The admin dashboard shows totals from these.

Events the screens need (suggested names):

| Event | From → to | Payload |
|---|---|---|
| `join` | player → server | pin, name, team, mascot |
| `player_joined` | server → host | the player |
| `phase` | server → all | phase, question index, ends at |
| `question` | server → all | the question **without** `correct` or `word` |
| `answer` | player → server | choice (index or word) |
| `answer_count` | server → host | answered so far / total |
| `result` | server → each player | correct?, points, streak, rank, total |
| `reveal` | server → all | correct answer and count per answer to everyone; the leaderboard to the host only |
| `closed` | server → players | host ended or left |

When the last question closes, send one `final` event to every screen with the team standings, the top 3 and the full ranking, so each phone can show all three end screens.

Never send `correct` or `word` to player phones before the question closes, or anyone can read the answer in the browser's dev tools.

## Front-end notes and where things live

All the logic is in `app.js`; the back end mostly swaps out the functions below. (Old vanilla-JS version — map to the React code.)

| What | Function / variable in `app.js` | Swap for |
|---|---|---|
| Saved data | `DB`, `save()`, `lsGet` / `lsSet` | API calls |
| Admin password | `ADMIN_PASSWORD`, the `signin` form handler | real sign-in |
| Game engine | `G`, `newGame`, `startQuestion`, `answer`, `endQuestion`, `advance`, `tick` | server state + events |
| Bots | `makeBot`, the `plan` set in `startQuestion` | real players |
| Answer check | `isCorrect`, `norm` | same rule on the server |
| Scoring | `endQuestion` | server scoring |
| Validation | `qProblem` | same rule on the server when saving |
| Routes | `route()` | unchanged |

Pages use hash routes: `#/` home, `#/join/<quizId>` pick nickname and team, `#/play` player screen, `#/host/<quizId>` host screen, `#/admin` dashboard, `#/admin/new` and `#/admin/edit/<id>` editor.

- Screens redraw whenever the phase changes (`setPhase` calls `render`), and timers update in place every 100 ms. Pushing a `phase` event into `setPhase` is enough to drive every screen.
- Layout switches at 900 px: laptop layout above, phone layout below.
- Player mascots are `img/<team>_<01-12>.png`; store the file name, not the image.
- Light and dark mode and the draggable mascot are front-end only and need nothing from the server.
