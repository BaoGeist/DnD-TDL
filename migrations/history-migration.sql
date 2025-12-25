-- Migration script to add status field and todo_history table
-- Run this SQL in your Supabase SQL Editor

-- Step 1: Add status column to todos table
-- This replaces the completed boolean with a status enum
DO $$
BEGIN
    -- Add status column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'todos' AND column_name = 'status') THEN
        ALTER TABLE todos ADD COLUMN status TEXT DEFAULT 'active';
    END IF;
END $$;

-- Step 2: Migrate existing completed data to status field
UPDATE todos
SET status = CASE
    WHEN completed = true THEN 'completed'
    ELSE 'active'
END
WHERE status = 'active'; -- Only update rows that haven't been manually set

-- Step 3: Drop the old completed column (optional - uncomment if you want to remove it)
-- ALTER TABLE todos DROP COLUMN IF EXISTS completed;

-- Step 4: Add constraint to ensure valid status values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'todos_status_check'
    ) THEN
        ALTER TABLE todos ADD CONSTRAINT todos_status_check
        CHECK (status IN ('active', 'completed', 'deleted'));
    END IF;
END $$;

-- Step 5: Create todo_history table
CREATE TABLE IF NOT EXISTS todo_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    todo_id UUID NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('created', 'updated', 'completed', 'deleted')),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    changes JSONB, -- stores what changed (e.g., {"field": "text", "old": "foo", "new": "bar"})
    snapshot JSONB NOT NULL -- full snapshot of todo at that moment
);

-- Step 6: Add index on todo_id for faster queries
CREATE INDEX IF NOT EXISTS idx_todo_history_todo_id ON todo_history(todo_id);
CREATE INDEX IF NOT EXISTS idx_todo_history_timestamp ON todo_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_todo_history_event_type ON todo_history(event_type);

-- Step 7: Add index on status for todos table
CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status);

-- Step 8: Enable Row Level Security for todo_history
ALTER TABLE todo_history ENABLE ROW LEVEL SECURITY;

-- Step 9: Create policy for todo_history (adjust for your security needs)
DROP POLICY IF EXISTS "Allow all operations for todo_history" ON todo_history;
CREATE POLICY "Allow all operations for todo_history" ON todo_history
FOR ALL USING (true) WITH CHECK (true);

-- Step 10: Create a function to automatically log history on todo changes (optional)
-- This can be used as a trigger if you want automatic history logging
CREATE OR REPLACE FUNCTION log_todo_history()
RETURNS TRIGGER AS $$
BEGIN
    -- On INSERT
    IF TG_OP = 'INSERT' THEN
        INSERT INTO todo_history (todo_id, event_type, snapshot)
        VALUES (
            NEW.id,
            'created',
            row_to_json(NEW)::jsonb
        );
        RETURN NEW;
    END IF;

    -- On UPDATE
    IF TG_OP = 'UPDATE' THEN
        -- Only log if significant fields changed
        IF (OLD.text IS DISTINCT FROM NEW.text OR
            OLD.status IS DISTINCT FROM NEW.status OR
            OLD."estimatedHours" IS DISTINCT FROM NEW."estimatedHours") THEN

            -- Build changes object
            DECLARE
                changes_obj JSONB := '{}'::jsonb;
            BEGIN
                IF OLD.text IS DISTINCT FROM NEW.text THEN
                    changes_obj := changes_obj || jsonb_build_object('text', jsonb_build_object('old', OLD.text, 'new', NEW.text));
                END IF;

                IF OLD.status IS DISTINCT FROM NEW.status THEN
                    changes_obj := changes_obj || jsonb_build_object('status', jsonb_build_object('old', OLD.status, 'new', NEW.status));
                END IF;

                IF OLD."estimatedHours" IS DISTINCT FROM NEW."estimatedHours" THEN
                    changes_obj := changes_obj || jsonb_build_object('estimatedHours', jsonb_build_object('old', OLD."estimatedHours", 'new', NEW."estimatedHours"));
                END IF;

                -- Determine event type
                DECLARE
                    event_type_val TEXT := 'updated';
                BEGIN
                    IF OLD.status != 'completed' AND NEW.status = 'completed' THEN
                        event_type_val := 'completed';
                    END IF;

                    INSERT INTO todo_history (todo_id, event_type, changes, snapshot)
                    VALUES (
                        NEW.id,
                        event_type_val,
                        changes_obj,
                        row_to_json(NEW)::jsonb
                    );
                END;
            END;
        END IF;
        RETURN NEW;
    END IF;

    -- On DELETE (or status change to deleted)
    IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW.status = 'deleted' AND OLD.status != 'deleted') THEN
        INSERT INTO todo_history (todo_id, event_type, snapshot)
        VALUES (
            COALESCE(NEW.id, OLD.id),
            'deleted',
            row_to_json(COALESCE(NEW, OLD))::jsonb
        );
        RETURN COALESCE(NEW, OLD);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 11: Create trigger (OPTIONAL - uncomment if you want automatic history logging via database triggers)
-- Note: If you prefer manual logging from your application, skip this step
-- DROP TRIGGER IF EXISTS todo_history_trigger ON todos;
-- CREATE TRIGGER todo_history_trigger
-- AFTER INSERT OR UPDATE OR DELETE ON todos
-- FOR EACH ROW
-- EXECUTE FUNCTION log_todo_history();

COMMIT;
