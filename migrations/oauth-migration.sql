-- OAuth Migration: Add user authentication and multi-user support
-- Run this SQL in your Supabase SQL Editor AFTER setting up Auth providers

-- Step 1: Add user_id column to todos table
DO $$
BEGIN
    -- Add user_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'todos' AND column_name = 'user_id') THEN
        ALTER TABLE todos ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Step 2: Add user_id column to todo_history table
DO $$
BEGIN
    -- Add user_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'todo_history' AND column_name = 'user_id') THEN
        ALTER TABLE todo_history ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Step 3: Create index on user_id for better performance
CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
CREATE INDEX IF NOT EXISTS idx_todo_history_user_id ON todo_history(user_id);

-- Step 4: Update existing todos to belong to first user (MANUAL STEP)
-- IMPORTANT: You need to manually set the user_id for existing todos
-- Option 1: After creating your first user account, run:
--   UPDATE todos SET user_id = 'YOUR_USER_UUID_HERE' WHERE user_id IS NULL;
--
-- Option 2: Delete all existing todos before starting:
--   DELETE FROM todos;
--   DELETE FROM todo_history;

-- Step 5: Make user_id NOT NULL after migrating existing data
-- UNCOMMENT THIS AFTER MIGRATING EXISTING TODOS:
-- ALTER TABLE todos ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE todo_history ALTER COLUMN user_id SET NOT NULL;

-- Step 6: Update RLS policies for todos table
DROP POLICY IF EXISTS "Allow all operations for todos" ON todos;

-- Users can only see their own todos
CREATE POLICY "Users can view own todos" ON todos
    FOR SELECT USING (auth.uid() = user_id);

-- Users can only insert their own todos
CREATE POLICY "Users can insert own todos" ON todos
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only update their own todos
CREATE POLICY "Users can update own todos" ON todos
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can only delete their own todos
CREATE POLICY "Users can delete own todos" ON todos
    FOR DELETE USING (auth.uid() = user_id);

-- Step 7: Update RLS policies for todo_history table
DROP POLICY IF EXISTS "Allow all operations for todo_history" ON todo_history;

-- Users can only see their own history
CREATE POLICY "Users can view own history" ON todo_history
    FOR SELECT USING (auth.uid() = user_id);

-- Users can only insert their own history
CREATE POLICY "Users can insert own history" ON todo_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only update their own history (rare case)
CREATE POLICY "Users can update own history" ON todo_history
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can only delete their own history
CREATE POLICY "Users can delete own history" ON todo_history
    FOR DELETE USING (auth.uid() = user_id);

-- Step 8: Update the history logging function to include user_id
CREATE OR REPLACE FUNCTION log_todo_history()
RETURNS TRIGGER AS $$
BEGIN
    -- On INSERT
    IF TG_OP = 'INSERT' THEN
        INSERT INTO todo_history (todo_id, user_id, event_type, snapshot)
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

                    INSERT INTO todo_history (todo_id, user_id, event_type, changes, snapshot)
                    VALUES (
                        NEW.id,
                        NEW.user_id,
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
        INSERT INTO todo_history (todo_id, user_id, event_type, snapshot)
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

COMMIT;

-- ============================================
-- SETUP INSTRUCTIONS
-- ============================================
--
-- Before running this migration:
-- 1. Go to Supabase Dashboard > Authentication > Providers
-- 2. Enable Email provider (enabled by default)
-- 3. Enable Google provider:
--    - Create OAuth credentials at https://console.cloud.google.com/
--    - Add authorized redirect URI: https://YOUR_PROJECT.supabase.co/auth/v1/callback
--    - Copy Client ID and Client Secret to Supabase
--
-- After running this migration:
-- 1. Create your first user account via the app
-- 2. Get your user UUID from: SELECT id FROM auth.users;
-- 3. Migrate existing todos: UPDATE todos SET user_id = 'YOUR_UUID' WHERE user_id IS NULL;
-- 4. Uncomment Step 5 above and run to make user_id NOT NULL
--
-- ============================================
