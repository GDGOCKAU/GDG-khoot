# GDG KAUHOOT backend

The backend foundation is a standalone Node.js service. It uses Fastify for HTTP,
Prisma/PostgreSQL for persistence, and Socket.IO for realtime session events.

## Local setup

```sh
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

The seed creates `admin@gdg-kauhoot.local` with the development password
`change-me`; replace it before using a shared environment.

## Initial API contract

- `GET /health`
- `POST /api/v1/auth/login` with `{ "email", "password" }`
- `GET /api/v1/quizzes` (admin bearer token)
- `POST /api/v1/quizzes` with `{ "title", "description?" }`
- `GET/PATCH/DELETE /api/v1/quizzes/:id`
- `POST /api/v1/quizzes/:id/questions` with question text, order, time limit, and options

Socket.IO currently exposes `session:join` and joins the caller to the
`session:<id>` room. Game lifecycle, authoritative timing, scoring, and
leaderboards are intentionally deferred to the next implementation phase.
