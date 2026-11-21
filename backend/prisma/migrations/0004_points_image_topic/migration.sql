-- Nullable additions only; existing rows keep working (null points = 1).
ALTER TABLE "Question"
ADD COLUMN "imageUrl" TEXT,
ADD COLUMN "points" INTEGER;

ALTER TABLE "Quiz"
ADD COLUMN "topic" TEXT;
