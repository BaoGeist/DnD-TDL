-- Database Migration Script for Multi-Week Support
-- Run this in your Supabase SQL Editor

-- Step 1: Add the scheduledDate column
ALTER TABLE todos ADD COLUMN IF NOT EXISTS scheduledDate timestamp;

-- Step 2: Migrate existing dayOfWeek data to scheduledDate using last week as base
-- Last week: September 20-26, 2025 (Monday to Sunday)

UPDATE todos
SET "scheduleddate" = (
  CASE "dayOfWeek"
    WHEN 'Monday' THEN '2025-09-22 00:00:00'::timestamp
    WHEN 'Tuesday' THEN '2025-09-23 00:00:00'::timestamp
    WHEN 'Wednesday' THEN '2025-09-24 00:00:00'::timestamp
    WHEN 'Thursday' THEN '2025-09-25 00:00:00'::timestamp
    WHEN 'Friday' THEN '2025-09-26 00:00:00'::timestamp
    WHEN 'Saturday' THEN '2025-09-27 00:00:00'::timestamp
    WHEN 'Sunday' THEN '2025-09-28 00:00:00'::timestamp
  END
)
WHERE "dayOfWeek" IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')
  AND "scheduleddate" IS NULL;

-- Step 3: Verify the migration
SELECT
  "dayOfWeek",
  "scheduleddate",
  text,
  COUNT(*) as task_count
FROM todos
WHERE "scheduleddate" IS NOT NULL
GROUP BY "dayOfWeek", "scheduleddate", text
ORDER BY "scheduleddate";

-- Step 4: Check for any unmigrated tasks
SELECT
  "dayOfWeek",
  text,
  COUNT(*) as unmigrated_count
FROM todos
WHERE "dayOfWeek" IS NOT NULL
  AND "dayOfWeek" != 'backlog'
  AND "scheduleddate" IS NULL
GROUP BY "dayOfWeek", text;