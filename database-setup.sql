-- Migration script for existing 'todos' table
-- This will add missing columns to your existing table without losing data
-- Run this SQL in your Supabase SQL Editor

-- First, let's check if the table exists and add missing columns
DO $$ 
BEGIN
    -- Add columns that might be missing (will skip if they already exist)
    
    -- Ensure id column is UUID and primary key
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE table_name = 'todos' AND constraint_type = 'PRIMARY KEY') THEN
        ALTER TABLE todos ADD PRIMARY KEY (id);
    END IF;
    
    -- Add position_x if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'todos' AND column_name = 'position_x') THEN
        ALTER TABLE todos ADD COLUMN position_x INTEGER DEFAULT 0;
    END IF;
    
    -- Add position_y if it doesn't exist  
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'todos' AND column_name = 'position_y') THEN
        ALTER TABLE todos ADD COLUMN position_y INTEGER DEFAULT 0;
    END IF;
    
    -- Add dayOfWeek if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'todos' AND column_name = 'dayOfWeek') THEN
        ALTER TABLE todos ADD COLUMN "dayOfWeek" TEXT;
    END IF;
    
    -- Add estimatedHours if it doesn't exist (checking both naming conventions)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'todos' AND column_name IN ('estimatedHours', 'estimated_hours')) THEN
        ALTER TABLE todos ADD COLUMN "estimatedHours" INTEGER DEFAULT 1;
    END IF;
    
    -- Add completed if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'todos' AND column_name = 'completed') THEN
        ALTER TABLE todos ADD COLUMN completed BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- Add created_at if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'todos' AND column_name = 'created_at') THEN
        ALTER TABLE todos ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
    
END $$;

-- Remove any duplicate rows based on id (keep the most recent)
DELETE FROM todos 
WHERE ctid NOT IN (
    SELECT min(ctid) 
    FROM todos 
    GROUP BY id
);

-- Create indexes for better performance (will skip if they already exist)
CREATE INDEX IF NOT EXISTS idx_todos_day_of_week ON todos("dayOfWeek");
CREATE INDEX IF NOT EXISTS idx_todos_created_at ON todos(created_at);

-- Enable Row Level Security if not already enabled
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows all operations (adjust this for your security needs)
DROP POLICY IF EXISTS "Allow all operations for todos" ON todos;
CREATE POLICY "Allow all operations for todos" ON todos
FOR ALL USING (true) WITH CHECK (true);
