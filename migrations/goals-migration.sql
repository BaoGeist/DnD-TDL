-- Goals Migration: Add Long Term Goals feature
-- Run this SQL in your Supabase SQL Editor

-- Step 1: Create goals table
CREATE TABLE IF NOT EXISTS goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES goals(id) ON DELETE SET NULL,
    period TEXT NOT NULL CHECK (period IN ('yearly', 'quarterly', 'monthly')),
    target_date DATE NOT NULL,
    text TEXT NOT NULL,
    description TEXT,
    position INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'deleted')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_parent_id ON goals(parent_id);
CREATE INDEX IF NOT EXISTS idx_goals_period ON goals(period);
CREATE INDEX IF NOT EXISTS idx_goals_target_date ON goals(target_date);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);
CREATE INDEX IF NOT EXISTS idx_goals_position ON goals(position);

-- Step 3: Create composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_goals_user_period_status ON goals(user_id, period, status);

-- Step 4: Create updated_at trigger
CREATE OR REPLACE FUNCTION update_goals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER goals_updated_at_trigger
    BEFORE UPDATE ON goals
    FOR EACH ROW
    EXECUTE FUNCTION update_goals_updated_at();

-- Step 5: Enable Row Level Security
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

-- Step 6: Create RLS policies for user isolation
-- Users can view their own goals
CREATE POLICY "Users can view own goals" ON goals
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own goals
CREATE POLICY "Users can insert own goals" ON goals
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own goals
CREATE POLICY "Users can update own goals" ON goals
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own goals
CREATE POLICY "Users can delete own goals" ON goals
    FOR DELETE USING (auth.uid() = user_id);

-- Step 7: Create goals_history table for audit logging
CREATE TABLE IF NOT EXISTS goals_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('created', 'updated', 'completed', 'deleted')),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    changes JSONB,
    snapshot JSONB NOT NULL
);

-- Step 8: Create indexes for goals_history
CREATE INDEX IF NOT EXISTS idx_goals_history_goal_id ON goals_history(goal_id);
CREATE INDEX IF NOT EXISTS idx_goals_history_user_id ON goals_history(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_history_timestamp ON goals_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_goals_history_event_type ON goals_history(event_type);

-- Step 9: Enable RLS for goals_history
ALTER TABLE goals_history ENABLE ROW LEVEL SECURITY;

-- Step 10: Create RLS policies for goals_history
CREATE POLICY "Users can view own goals history" ON goals_history
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own goals history" ON goals_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goals history" ON goals_history
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own goals history" ON goals_history
    FOR DELETE USING (auth.uid() = user_id);

-- Step 11: Create function to automatically log goals history (optional)
CREATE OR REPLACE FUNCTION log_goals_history()
RETURNS TRIGGER AS $$
BEGIN
    -- On INSERT
    IF TG_OP = 'INSERT' THEN
        INSERT INTO goals_history (goal_id, user_id, event_type, snapshot)
        VALUES (
            NEW.id,
            NEW.user_id,
            'created',
            row_to_json(NEW)::jsonb
        );
        RETURN NEW;
    END IF;

    -- On UPDATE
    IF TG_OP = 'UPDATE' THEN
        -- Only log if significant fields changed
        IF (OLD.text IS DISTINCT FROM NEW.text OR
            OLD.description IS DISTINCT FROM NEW.description OR
            OLD.status IS DISTINCT FROM NEW.status OR
            OLD.target_date IS DISTINCT FROM NEW.target_date OR
            OLD.parent_id IS DISTINCT FROM NEW.parent_id) THEN

            DECLARE
                changes_obj JSONB := '{}'::jsonb;
                event_type_val TEXT := 'updated';
            BEGIN
                -- Build changes object
                IF OLD.text IS DISTINCT FROM NEW.text THEN
                    changes_obj := changes_obj || jsonb_build_object('text', jsonb_build_object('old', OLD.text, 'new', NEW.text));
                END IF;

                IF OLD.description IS DISTINCT FROM NEW.description THEN
                    changes_obj := changes_obj || jsonb_build_object('description', jsonb_build_object('old', OLD.description, 'new', NEW.description));
                END IF;

                IF OLD.status IS DISTINCT FROM NEW.status THEN
                    changes_obj := changes_obj || jsonb_build_object('status', jsonb_build_object('old', OLD.status, 'new', NEW.status));
                END IF;

                IF OLD.target_date IS DISTINCT FROM NEW.target_date THEN
                    changes_obj := changes_obj || jsonb_build_object('target_date', jsonb_build_object('old', OLD.target_date, 'new', NEW.target_date));
                END IF;

                IF OLD.parent_id IS DISTINCT FROM NEW.parent_id THEN
                    changes_obj := changes_obj || jsonb_build_object('parent_id', jsonb_build_object('old', OLD.parent_id, 'new', NEW.parent_id));
                END IF;

                -- Determine event type
                IF OLD.status != 'completed' AND NEW.status = 'completed' THEN
                    event_type_val := 'completed';
                END IF;

                INSERT INTO goals_history (goal_id, user_id, event_type, changes, snapshot)
                VALUES (
                    NEW.id,
                    NEW.user_id,
                    event_type_val,
                    changes_obj,
                    row_to_json(NEW)::jsonb
                );
            END;
        END IF;
        RETURN NEW;
    END IF;

    -- On DELETE (or status change to deleted)
    IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW.status = 'deleted' AND OLD.status != 'deleted') THEN
        INSERT INTO goals_history (goal_id, user_id, event_type, snapshot)
        VALUES (
            COALESCE(NEW.id, OLD.id),
            COALESCE(NEW.user_id, OLD.user_id),
            'deleted',
            row_to_json(COALESCE(NEW, OLD))::jsonb
        );
        RETURN COALESCE(NEW, OLD);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 12: Create trigger for automatic history logging (OPTIONAL - uncomment if desired)
-- Note: Like todos, you may prefer manual logging from application code
-- DROP TRIGGER IF EXISTS goals_history_trigger ON goals;
-- CREATE TRIGGER goals_history_trigger
-- AFTER INSERT OR UPDATE OR DELETE ON goals
-- FOR EACH ROW
-- EXECUTE FUNCTION log_goals_history();

COMMIT;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
--
-- Database structure:
-- - goals table with hierarchical support (parent_id)
-- - Three period types: yearly, quarterly, monthly
-- - Soft delete via status field
-- - RLS policies for user isolation
-- - goals_history table for audit logging
-- - Automatic updated_at timestamp
--
-- Next steps:
-- 1. Create TypeScript interface in components (similar to Todo)
-- 2. Create historyLogger utility for goals
-- 3. Implement GoalsDashboard and MobileGoals components
-- 4. Add navigation toggle between Weekly Planner and Goals view
--
-- ============================================
