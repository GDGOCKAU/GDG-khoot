CREATE TYPE "GameStatus" AS ENUM ('LOBBY', 'ACTIVE', 'REVEAL', 'FINISHED', 'CANCELLED');

CREATE TABLE "GameSession" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "pin" TEXT NOT NULL,
    "status" "GameStatus" NOT NULL DEFAULT 'LOBBY',
    "currentQuestionOrder" INTEGER,
    "questionStartedAt" TIMESTAMP(3),
    "closesAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Participant" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NOT NULL,
    "name" TEXT NOT NULL,
    "mascot" TEXT NOT NULL,
    "team" TEXT NOT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Answer" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "points" INTEGER NOT NULL,
    "respondedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GameSession_pin_key" ON "GameSession"("pin");
CREATE INDEX "GameSession_quizId_idx" ON "GameSession"("quizId");
CREATE INDEX "GameSession_hostId_idx" ON "GameSession"("hostId");
CREATE INDEX "GameSession_status_idx" ON "GameSession"("status");
CREATE UNIQUE INDEX "Participant_sessionId_name_key" ON "Participant"("sessionId", "name");
CREATE INDEX "Participant_sessionId_idx" ON "Participant"("sessionId");
CREATE INDEX "Participant_team_idx" ON "Participant"("team");
CREATE UNIQUE INDEX "Answer_participantId_questionId_key" ON "Answer"("participantId", "questionId");
CREATE INDEX "Answer_sessionId_idx" ON "Answer"("sessionId");
CREATE INDEX "Answer_questionId_idx" ON "Answer"("questionId");

ALTER TABLE "Participant" ADD CONSTRAINT "Participant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
