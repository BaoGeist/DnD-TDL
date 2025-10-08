-- Backfill history log with existing todos
-- This script creates history entries for all existing tasks in the database

-- Step 1: Create 'created' events for all existing todos
-- Use the original created_at timestamp from the todo
INSERT INTO todo_history (todo_id, event_type, timestamp, snapshot, changes)
SELECT
    id,
    'created',
    created_at, -- Use the original creation timestamp
    jsonb_build_object(
        'id', id,
        'text', text,
        'estimatedHours', COALESCE("estimatedHours", estimated_hours, 1),
        'status', COALESCE(status, CASE WHEN completed = true THEN 'completed' ELSE 'active' END),
        'dayOfWeek', "dayOfWeek",
        'scheduleddate', scheduleddate,
        'position_x', position_x,
        'position_y', position_y
    ),
    NULL -- No changes for creation event
FROM todos
WHERE status != 'deleted' OR status IS NULL; -- Only process non-deleted tasks

-- Step 2: Create 'completed' events for tasks that are already completed
-- Use the current timestamp for completed tasks (since we don't know when they were actually completed)
INSERT INTO todo_history (todo_id, event_type, timestamp, snapshot, changes)
SELECT
    id,
    'completed',
    NOW(), -- Use current time since we don't know when they were completed
    jsonb_build_object(
        'id', id,
        'text', text,
        'estimatedHours', COALESCE("estimatedHours", estimated_hours, 1),
        'status', 'completed',
        'dayOfWeek', "dayOfWeek",
        'scheduleddate', scheduleddate,
        'position_x', position_x,
        'position_y', position_y
    ),
    jsonb_build_object(
        'status', jsonb_build_object(
            'old', 'active',
            'new', 'completed'
        )
    ) -- Record the status change
FROM todos
WHERE (status = 'completed' OR (status IS NULL AND completed = true))
    AND id IN (
        -- Only add completed event if we added a created event
        SELECT todo_id FROM todo_history WHERE event_type = 'created'
    );

-- Verify the backfill
SELECT
    event_type,
    COUNT(*) as count
FROM todo_history
GROUP BY event_type
ORDER BY event_type;
