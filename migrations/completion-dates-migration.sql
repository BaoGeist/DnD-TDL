-- Completion Dates Migration: Track when goals are checked off
-- Run this SQL in your Supabase SQL Editor

-- Step 1: Add completion_dates column to store array of completion timestamps
DO $$
BEGIN
    -- Add completion_dates column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'goals' AND column_name = 'completion_dates') THEN
        ALTER TABLE goals ADD COLUMN completion_dates JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- Step 2: Create index for better query performance on completion_dates
CREATE INDEX IF NOT EXISTS idx_goals_completion_dates ON goals USING GIN (completion_dates);

-- Step 3: Add a function to validate completion_dates format (array of ISO timestamps)
CREATE OR REPLACE FUNCTION validate_completion_dates()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure completion_dates is an array
    IF NEW.completion_dates IS NOT NULL AND jsonb_typeof(NEW.completion_dates) != 'array' THEN
        RAISE EXCEPTION 'completion_dates must be a JSON array';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create trigger to validate completion_dates on insert/update
DROP TRIGGER IF EXISTS validate_completion_dates_trigger ON goals;
CREATE TRIGGER validate_completion_dates_trigger
    BEFORE INSERT OR UPDATE ON goals
    FOR EACH ROW
    EXECUTE FUNCTION validate_completion_dates();

COMMIT;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
--
-- New field added:
-- - completion_dates: JSONB array storing ISO timestamp strings
--   Example: ["2025-12-24T10:30:00.000Z", "2025-12-25T09:15:00.000Z"]
--
-- Use cases:
-- - Track each time a recurring goal is checked off
-- - Display completion history/streaks
-- - Calculate completion frequency
-- - Show last completion date
--
-- Next steps:
-- 1. Update Goal interface with completionDates?: Date[]
-- 2. Update handleToggleComplete to append current date
-- 3. Update database operations to save/load completion_dates
-- 4. Update history logger to track completion_dates changes
--
-- ============================================
