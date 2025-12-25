-- Add Daily Period and Completion Counter for Goals
-- Adds support for daily recurring goals and tracks completion count for recurring goals
-- Run this SQL in your Supabase SQL Editor AFTER target-date-optional-migration.sql

-- Step 1: Modify period constraint to include 'daily'
DO $$
BEGIN
    -- Drop the old constraint if it exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'goals_period_check'
    ) THEN
        ALTER TABLE goals DROP CONSTRAINT goals_period_check;
    END IF;
END $$;

-- Add new constraint with 'daily' option
ALTER TABLE goals ADD CONSTRAINT goals_period_check
CHECK (period IN ('yearly', 'quarterly', 'monthly', 'daily'));

-- Step 2: Add completion_count column to goals table
DO $$
BEGIN
    -- Add completion_count column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'goals' AND column_name = 'completion_count') THEN
        ALTER TABLE goals ADD COLUMN completion_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- Step 3: Create index on completion_count for better performance
CREATE INDEX IF NOT EXISTS idx_goals_completion_count ON goals(completion_count);

-- Step 4: Add constraint to ensure completion_count is non-negative
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'goals_completion_count_check'
    ) THEN
        ALTER TABLE goals ADD CONSTRAINT goals_completion_count_check
        CHECK (completion_count >= 0);
    END IF;
END $$;

-- Step 5: Update the recurring_period_check constraint to include daily
DO $$
BEGIN
    -- Drop the old constraint if it exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'goals_recurring_period_check'
    ) THEN
        ALTER TABLE goals DROP CONSTRAINT goals_recurring_period_check;
    END IF;
END $$;

-- Add new constraint with daily included
ALTER TABLE goals ADD CONSTRAINT goals_recurring_period_check
CHECK (
    (is_recurring = true AND specific_period IS NULL) OR
    (is_recurring = false AND (period = 'yearly' OR specific_period IS NOT NULL))
);

-- Step 6: Add comment to explain completion_count usage
COMMENT ON COLUMN goals.completion_count IS 'Number of times this goal has been completed. Used primarily for recurring goals to track streaks.';

COMMIT;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
--
-- Changes:
-- - Added 'daily' as a valid period type
-- - Added completion_count field (default 0)
-- - Completion count tracks how many times a recurring goal is checked off
-- - For non-recurring goals, completion_count is 0 or 1 (one-time completion)
--
-- Usage:
-- - Daily recurring goals: Track daily habits (e.g., "Exercise", "Read")
-- - Completion counter: Shows streak/count for recurring goals
-- - When user checks off a recurring goal, increment completion_count
-- - Status remains "active" for recurring goals (never "completed")
--
-- ============================================
