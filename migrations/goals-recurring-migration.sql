-- Goals Recurring/Specific Period Enhancement
-- Adds support for distinguishing between recurring goals and period-specific goals
-- Run this SQL in your Supabase SQL Editor AFTER goals-migration.sql

-- Step 1: Add is_recurring column to goals table
DO $$
BEGIN
    -- Add is_recurring column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'goals' AND column_name = 'is_recurring') THEN
        ALTER TABLE goals ADD COLUMN is_recurring BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Step 2: Add specific_period column to goals table
-- Format: "2026-Q1", "2026-Q2", "2026-01", "2026-02", etc.
DO $$
BEGIN
    -- Add specific_period column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'goals' AND column_name = 'specific_period') THEN
        ALTER TABLE goals ADD COLUMN specific_period TEXT;
    END IF;
END $$;

-- Step 3: Create index on is_recurring for better performance
CREATE INDEX IF NOT EXISTS idx_goals_is_recurring ON goals(is_recurring);
CREATE INDEX IF NOT EXISTS idx_goals_specific_period ON goals(specific_period);

-- Step 4: Create composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_goals_user_period_recurring 
ON goals(user_id, period, is_recurring, status);

-- Step 5: Add constraint to ensure logic consistency
-- If is_recurring = true, then specific_period should be NULL
-- If is_recurring = false, then specific_period should be NOT NULL (for quarterly/monthly)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'goals_recurring_period_check'
    ) THEN
        ALTER TABLE goals ADD CONSTRAINT goals_recurring_period_check
        CHECK (
            (is_recurring = true AND specific_period IS NULL) OR
            (is_recurring = false AND (period = 'yearly' OR specific_period IS NOT NULL))
        );
    END IF;
END $$;

-- Step 6: Migrate existing goals to default behavior (all non-recurring, with auto-generated periods)
-- For quarterly goals: assign to current/next quarter based on target_date
-- For monthly goals: assign to specific month based on target_date
UPDATE goals
SET 
    is_recurring = false,
    specific_period = CASE
        WHEN period = 'quarterly' THEN 
            TO_CHAR(target_date, 'YYYY') || '-Q' || TO_CHAR(EXTRACT(QUARTER FROM target_date), 'FM9')
        WHEN period = 'monthly' THEN 
            TO_CHAR(target_date, 'YYYY-MM')
        ELSE NULL  -- yearly goals don't need specific_period
    END
WHERE is_recurring IS NULL OR is_recurring = false;

COMMIT;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
--
-- New fields added:
-- - is_recurring: boolean (default false) - indicates if goal repeats
-- - specific_period: text (nullable) - format "YYYY-QN" or "YYYY-MM"
--
-- Logic rules:
-- - Yearly goals: always have specific_period = NULL
-- - Quarterly recurring: is_recurring = true, specific_period = NULL
-- - Quarterly specific: is_recurring = false, specific_period = "2026-Q1"
-- - Monthly recurring: is_recurring = true, specific_period = NULL
-- - Monthly specific: is_recurring = false, specific_period = "2026-01"
--
-- Next steps:
-- 1. Update Goal interface to include isRecurring and specificPeriod
-- 2. Update GoalsDashboard to show dual sections
-- 3. Update GoalInput to allow selecting recurring vs specific
-- 4. Update mobile view for consistency
--
-- ============================================
