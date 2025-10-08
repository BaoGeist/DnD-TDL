import { supabase } from "./supabaseClient";
import { Todo } from "../components/DragDropTodoList";

/**
 * Log a history event for a todo item
 */
export async function logHistoryEvent(
  todoId: string,
  eventType: 'created' | 'updated' | 'completed' | 'deleted',
  snapshot: Todo,
  changes?: Record<string, { old: unknown; new: unknown }>
) {
  try {
    const historyEntry = {
      todo_id: todoId,
      event_type: eventType,
      snapshot: {
        id: snapshot.id,
        text: snapshot.text,
        estimatedHours: snapshot.estimatedHours,
        status: snapshot.status,
        dayOfWeek: snapshot.dayOfWeek || null,
        scheduleddate: snapshot.scheduledDate?.toISOString() || null,
        position_x: snapshot.position.x,
        position_y: snapshot.position.y,
      },
      changes: changes || null,
    };

    const { error } = await supabase
      .from('todo_history')
      .insert([historyEntry]);

    if (error) {
      console.error('Failed to log history event:', error);
    }
  } catch (err) {
    console.error('Error logging history:', err);
  }
}

/**
 * Log todo creation
 */
export async function logTodoCreated(todo: Todo) {
  await logHistoryEvent(todo.id, 'created', todo);
}

/**
 * Log todo update
 * Only logs if significant fields (text, status, estimatedHours) changed
 */
export async function logTodoUpdated(
  todoId: string,
  oldTodo: Todo,
  newTodo: Todo
) {
  const changes: Record<string, { old: unknown; new: unknown }> = {};

  // Check text change
  if (oldTodo.text !== newTodo.text) {
    changes.text = { old: oldTodo.text, new: newTodo.text };
  }

  // Check status change
  if (oldTodo.status !== newTodo.status) {
    changes.status = { old: oldTodo.status, new: newTodo.status };

    // If status changed to completed, log as completed event
    if (newTodo.status === 'completed' && oldTodo.status !== 'completed') {
      await logHistoryEvent(todoId, 'completed', newTodo, changes);
      return;
    }
  }

  // Check estimatedHours change
  if (oldTodo.estimatedHours !== newTodo.estimatedHours) {
    changes.estimatedHours = {
      old: oldTodo.estimatedHours,
      new: newTodo.estimatedHours,
    };
  }

  // Only log if there are significant changes
  if (Object.keys(changes).length > 0) {
    await logHistoryEvent(todoId, 'updated', newTodo, changes);
  }
}

/**
 * Log todo deletion
 */
export async function logTodoDeleted(todo: Todo) {
  await logHistoryEvent(todo.id, 'deleted', todo);
}
