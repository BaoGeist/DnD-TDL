-- Make target_date nullable for goals
-- This allows recurring and specific period goals to not require a target date
-- Run this SQL in your Supabase SQL Editor AFTER goals-recurring-migration.sql

-- Step 1: Make target_date column nullable
ALTER TABLE goals ALTER COLUMN target_date DROP NOT NULL;

-- Step 2: Add comment to explain when target_date is used
COMMENT ON COLUMN goals.target_date IS 'Target date for yearly goals. Optional for quarterly/monthly goals as they use specific_period instead.';

COMMIT;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
--
-- Changes:
-- - target_date is now nullable
-- - Yearly goals: Use target_date for specific deadline
-- - Quarterly/Monthly specific: Use specific_period (e.g., "2026-Q1", "2026-01")
-- - Quarterly/Monthly recurring: Use neither (ongoing goals)
--
-- ============================================
