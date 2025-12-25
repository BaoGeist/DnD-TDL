import { supabase } from "./supabaseClient";

export interface Goal {
  id: string;
  userId: string;
  parentId: string | null;
  period: "yearly" | "quarterly" | "monthly" | "daily";
  targetDate?: Date;
  text: string;
  description?: string;
  position: number;
  status: "active" | "completed" | "deleted";
  isRecurring: boolean;
  specificPeriod: string | null; // Format: "2026-Q1", "2026-Q2" or "2026-01", "2026-02" or "2025-12-24" for daily
  completionCount: number;
  completionDates?: Date[]; // Array of completion timestamps
}

/**
 * Log a history event for a goal item
 */
export async function logGoalHistoryEvent(
  goalId: string,
  eventType: "created" | "updated" | "completed" | "deleted",
  snapshot: Goal,
  changes?: Record<string, { old: unknown; new: unknown }>
) {
  try {
    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      console.error("Cannot log history: no authenticated user");
      return;
    }

    const historyEntry = {
      goal_id: goalId,
      user_id: user.id,
      event_type: eventType,
      snapshot: {
        id: snapshot.id,
        text: snapshot.text,
        description: snapshot.description || null,
        period: snapshot.period,
        target_date: snapshot.targetDate?.toISOString() || null,
        parent_id: snapshot.parentId || null,
        position: snapshot.position,
        status: snapshot.status,
        is_recurring: snapshot.isRecurring,
        specific_period: snapshot.specificPeriod || null,
        completion_count: snapshot.completionCount,
        completion_dates:
          snapshot.completionDates?.map((d) => d.toISOString()) || [],
      },
      changes: changes || null,
    };

    const { error } = await supabase
      .from("goals_history")
      .insert([historyEntry]);

    if (error) {
      console.error("Failed to log goal history event:", error);
    }
  } catch (err) {
    console.error("Error logging goal history:", err);
  }
}

/**
 * Log goal creation
 */
export async function logGoalCreated(goal: Goal) {
  await logGoalHistoryEvent(goal.id, "created", goal);
}

/**
 * Log goal update
 * Only logs if significant fields (text, description, status, targetDate, parentId) changed
 */
export async function logGoalUpdated(
  goalId: string,
  oldGoal: Goal,
  newGoal: Goal
) {
  const changes: Record<string, { old: unknown; new: unknown }> = {};

  // Check text change
  if (oldGoal.text !== newGoal.text) {
    changes.text = { old: oldGoal.text, new: newGoal.text };
  }

  // Check description change
  if (oldGoal.description !== newGoal.description) {
    changes.description = {
      old: oldGoal.description,
      new: newGoal.description,
    };
  }

  // Check status change
  if (oldGoal.status !== newGoal.status) {
    changes.status = { old: oldGoal.status, new: newGoal.status };

    // If status changed to completed, log as completed event
    if (newGoal.status === "completed" && oldGoal.status !== "completed") {
      await logGoalHistoryEvent(goalId, "completed", newGoal, changes);
      return;
    }
  }

  // Check target_date change (if both exist)
  if (
    oldGoal.targetDate &&
    newGoal.targetDate &&
    oldGoal.targetDate.getTime() !== newGoal.targetDate.getTime()
  ) {
    changes.targetDate = {
      old: oldGoal.targetDate.toISOString(),
      new: newGoal.targetDate.toISOString(),
    };
  }

  // Check completion_count change
  if (oldGoal.completionCount !== newGoal.completionCount) {
    changes.completion_count = {
      old: oldGoal.completionCount,
      new: newGoal.completionCount,
    };
  }

  // Check completionDates change
  const oldDates =
    oldGoal.completionDates?.map((d) => d.toISOString()).join(",") || "";
  const newDates =
    newGoal.completionDates?.map((d) => d.toISOString()).join(",") || "";
  if (oldDates !== newDates) {
    changes.completionDates = {
      old: oldGoal.completionDates?.map((d) => d.toISOString()) || [],
      new: newGoal.completionDates?.map((d) => d.toISOString()) || [],
    };
  }

  // Check parentId change
  if (oldGoal.parentId !== newGoal.parentId) {
    changes.parentId = { old: oldGoal.parentId, new: newGoal.parentId };
  }

  // Only log if there are significant changes
  if (Object.keys(changes).length > 0) {
    await logGoalHistoryEvent(goalId, "updated", newGoal, changes);
  }
}

/**
 * Log goal deletion
 */
export async function logGoalDeleted(goal: Goal) {
  await logGoalHistoryEvent(goal.id, "deleted", goal);
}
