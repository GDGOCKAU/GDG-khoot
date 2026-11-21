-- Existing quizzes keep moving on by themselves (the old behaviour).
ALTER TABLE "Quiz"
ADD COLUMN "autoAdvance" BOOLEAN NOT NULL DEFAULT true;
