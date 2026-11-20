# GDG KAUHOOT backend

The backend foundation is a standalone Node.js service. It uses Fastify for HTTP,
Prisma/PostgreSQL for persistence, and Socket.IO for realtime session events.

## Local setup

```sh
cp .env.example .env      # then set ADMIN_PASSWORD (8+ characters) and JWT_SECRET
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

The admin (`admin@gdg-kauhoot.local`) signs in with `ADMIN_PASSWORD` from `.env`. The server
creates the admin on first start and, on every start, replaces the stored password if the value
in `.env` changed (older sign-ins are signed out). It refuses to start when `ADMIN_PASSWORD` is
missing, shorter than 8 characters, or still the example value.

## Initial API contract

- `GET /health`
- `POST /api/v1/auth/login` with `{ "email", "password" }`
- `GET /api/v1/quizzes` (admin bearer token)
- `POST /api/v1/quizzes` with `{ "title", "description?" }`
- `GET/PATCH/DELETE /api/v1/quizzes/:id`
- `POST /api/v1/quizzes/:id/questions` with question text, order, time limit, and options

Socket.IO exposes `session:join` for the legacy room and `game:join` for an
isolated `game:<sessionId>` room. Game emissions include `phase`,
`player_joined`, `player_left`, `question`, `answer`, `result`, `reveal`,
`leaderboard`, `final`, and `session_cancelled`.

## Game API

- `POST /api/v1/sessions` (admin bearer token)
- `POST /api/v1/sessions/join`
- `POST /api/v1/sessions/:id/start` (admin bearer token)
- `POST /api/v1/sessions/:id/answers`
- `POST /api/v1/sessions/:id/reveal` (admin bearer token)
- `POST /api/v1/sessions/:id/next` (admin bearer token)
- `GET /api/v1/sessions/:id/leaderboard`
- `POST /api/v1/sessions/:id/leave`
- `POST /api/v1/sessions/:id/cancel` (admin bearer token)

Question windows close at a server-generated `closesAt`. Answers are
one-per-participant/per-question and are rejected after closure or reveal.
Scoring is 1000 base correctness points, up to 500 speed points, and a
50-point streak bonus per additional consecutive correct answer, capped at
300. Team leaderboard entries sum player scores.
