"use client";

import { useState, useEffect } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import {
  Plus,
  Calendar,
  Target,
  Repeat,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { format } from "date-fns";
import { GoalCard } from "./GoalCard";
import { GoalInput } from "./GoalInput";
import {
  Goal,
  logGoalCreated,
  logGoalUpdated,
  logGoalDeleted,
} from "@/utils/goalsHistoryLogger";
import { supabase } from "@/utils/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";

interface GoalsDashboardProps {
  onViewChange?: (view: "todos" | "goals") => void;
}

export function GoalsDashboard({ onViewChange }: GoalsDashboardProps = {}) {
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [defaultPeriod, setDefaultPeriod] = useState<
    "yearly" | "quarterly" | "monthly"
  >("monthly");
  const [collapsedPeriods, setCollapsedPeriods] = useState<Set<string>>(
    new Set()
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Fetch goals from database
  useEffect(() => {
    async function fetchGoals() {
      if (!user) return;

      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", user.id)
        .neq("status", "deleted")
        .order("position", { ascending: true });

      if (!error && data) {
        const transformedGoals = data.map((goal: Record<string, unknown>) => {
          // Parse targetDate to avoid timezone issues
          let targetDate: Date;
          if (goal.target_date) {
            const dateStr = goal.target_date as string;
            const [year, month, day] = dateStr
              .split("T")[0]
              .split("-")
              .map(Number);
            targetDate = new Date(year, month - 1, day);
          } else {
            targetDate = new Date();
          }

          return {
            id: goal.id as string,
            userId: goal.user_id as string,
            parentId: (goal.parent_id as string) || null,
            period: goal.period as "yearly" | "quarterly" | "monthly" | "daily",
            targetDate,
            text: (goal.text as string) || "",
            description: (goal.description as string) || undefined,
            position: (goal.position as number) || 0,
            status:
              (goal.status as "active" | "completed" | "deleted") || "active",
            isRecurring: (goal.is_recurring as boolean) || false,
            specificPeriod: (goal.specific_period as string) || null,
            completionCount: (goal.completion_count as number) || 0,
            completionDates: goal.completion_dates
              ? (goal.completion_dates as string[]).map((d) => new Date(d))
              : [],
          };
        });

        setGoals(transformedGoals);
      }
    }
    fetchGoals();
  }, [user]);

  // Categorize goals by period and recurring/specific
  const yearlyGoals = goals
    .filter((goal) => goal.period === "yearly")
    .sort((a, b) => a.position - b.position);

  const quarterlyRecurringGoals = goals
    .filter((goal) => goal.period === "quarterly" && goal.isRecurring)
    .sort((a, b) => a.position - b.position);
  const quarterlySpecificGoals = goals
    .filter((goal) => goal.period === "quarterly" && !goal.isRecurring)
    .sort((a, b) => a.position - b.position);

  const monthlyRecurringGoals = goals
    .filter((goal) => goal.period === "monthly" && goal.isRecurring)
    .sort((a, b) => a.position - b.position);
  const monthlySpecificGoals = goals
    .filter((goal) => goal.period === "monthly" && !goal.isRecurring)
    .sort((a, b) => a.position - b.position);

  const dailyRecurringGoals = goals
    .filter((goal) => goal.period === "daily" && goal.isRecurring)
    .sort((a, b) => a.position - b.position);
  const dailySpecificGoals = goals
    .filter((goal) => goal.period === "daily" && !goal.isRecurring)
    .sort((a, b) => a.position - b.position);

  // Get current quarter and month for highlighting
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);
  const currentMonth = (now.getMonth() + 1).toString().padStart(2, "0");
  const currentDay = now.toISOString().split("T")[0]; // "2025-12-24" format
  const currentQuarterPeriod = `${currentYear}-Q${currentQuarter}`;
  const currentMonthPeriod = `${currentYear}-${currentMonth}`;

  // Group quarterly specific goals by period
  const quarterlyByPeriod = quarterlySpecificGoals.reduce((acc, goal) => {
    const period = goal.specificPeriod || "unspecified";
    if (!acc[period]) acc[period] = [];
    acc[period].push(goal);
    return acc;
  }, {} as Record<string, Goal[]>);

  // Group monthly specific goals by period
  const monthlyByPeriod = monthlySpecificGoals.reduce((acc, goal) => {
    const period = goal.specificPeriod || "unspecified";
    if (!acc[period]) acc[period] = [];
    acc[period].push(goal);
    return acc;
  }, {} as Record<string, Goal[]>);

  // Group daily specific goals by period
  const dailyByPeriod = dailySpecificGoals.reduce((acc, goal) => {
    const period = goal.specificPeriod || "unspecified";
    if (!acc[period]) acc[period] = [];
    acc[period].push(goal);
    return acc;
  }, {} as Record<string, Goal[]>);

  // Get parent goal text helper
  const getParentGoalText = (parentId: string | null): string | null => {
    if (!parentId) return null;
    const parent = goals.find((g) => g.id === parentId);
    return parent ? parent.text : null;
  };

  // Toggle period collapse state
  const togglePeriodCollapse = (periodId: string) => {
    setCollapsedPeriods((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(periodId)) {
        newSet.delete(periodId);
      } else {
        newSet.add(periodId);
      }
      return newSet;
    });
  };

  // Handle create goal
  const handleCreateGoal = (
    period: "yearly" | "quarterly" | "monthly" | "daily"
  ) => {
    setDefaultPeriod(period === "daily" ? "monthly" : period);
    setEditingGoal(null);
    setIsModalOpen(true);
  };

  // Handle edit goal
  const _handleEditGoal = (goal: Goal) => {
    setEditingGoal(goal);
    setIsModalOpen(true);
  };

  // Handle save goal
  const handleSaveGoal = async (goalData: {
    text: string;
    description?: string;
    period: "yearly" | "quarterly" | "monthly" | "daily";
    targetDate?: Date;
    parentId: string | null;
    isRecurring: boolean;
    specificPeriod: string | null;
  }) => {
    if (!user) return;

    if (editingGoal) {
      // Update existing goal
      const updatedGoal = {
        ...editingGoal,
        ...goalData,
      };

      setGoals((prev) =>
        prev.map((g) => (g.id === editingGoal.id ? updatedGoal : g))
      );

      // Update database
      try {
        await supabase
          .from("goals")
          .update({
            text: goalData.text,
            description: goalData.description || null,
            period: goalData.period,
            target_date:
              goalData.targetDate?.toISOString() || new Date().toISOString(),
            parent_id: goalData.parentId,
            is_recurring: goalData.isRecurring,
            specific_period: goalData.specificPeriod,
          })
          .eq("id", editingGoal.id);

        await logGoalUpdated(editingGoal.id, editingGoal, updatedGoal);
      } catch (err) {
        console.error("Failed to update goal:", err);
      }
    } else {
      // Create new goal
      const newGoal: Goal = {
        id: crypto.randomUUID(),
        userId: user.id,
        ...goalData,
        position: goals.filter((g) => g.period === goalData.period).length,
        status: "active",
        completionCount: 0,
        completionDates: [],
      };

      setGoals((prev) => [...prev, newGoal]);

      // Save to database
      try {
        await supabase.from("goals").insert([
          {
            id: newGoal.id,
            user_id: newGoal.userId,
            parent_id: newGoal.parentId,
            period: newGoal.period,
            target_date:
              newGoal.targetDate?.toISOString() || new Date().toISOString(),
            text: newGoal.text,
            description: newGoal.description || null,
            position: newGoal.position,
            status: newGoal.status,
            is_recurring: newGoal.isRecurring,
            specific_period: newGoal.specificPeriod,
            completion_count: newGoal.completionCount,
            completion_dates:
              newGoal.completionDates?.map((d) => d.toISOString()) || [],
          },
        ]);

        await logGoalCreated(newGoal);
      } catch (err) {
        console.error("Failed to create goal:", err);
      }
    }
  };

  // Handle update goal
  const handleUpdateGoal = async (id: string, updates: Partial<Goal>) => {
    const oldGoal = goals.find((g) => g.id === id);
    if (!oldGoal) return;

    const updatedGoal = { ...oldGoal, ...updates };
    setGoals((prev) => prev.map((g) => (g.id === id ? updatedGoal : g)));

    // Update database
    try {
      const dbUpdates: Record<string, unknown> = {};
      if (updates.text !== undefined) dbUpdates.text = updates.text;
      if (updates.description !== undefined)
        dbUpdates.description = updates.description || null;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.period !== undefined) dbUpdates.period = updates.period;
      if (updates.targetDate !== undefined)
        dbUpdates.target_date = updates.targetDate.toISOString();
      if (updates.parentId !== undefined)
        dbUpdates.parent_id = updates.parentId;
      if (updates.completionCount !== undefined)
        dbUpdates.completion_count = updates.completionCount;
      if (updates.completionDates !== undefined)
        dbUpdates.completion_dates = updates.completionDates.map((d) =>
          d.toISOString()
        );

      await supabase.from("goals").update(dbUpdates).eq("id", id);
      await logGoalUpdated(id, oldGoal, updatedGoal);
    } catch (err) {
      console.error("Failed to update goal:", err);
    }
  };

  // Handle delete goal (soft delete)
  const handleDeleteGoal = async (id: string) => {
    const goalToDelete = goals.find((g) => g.id === id);
    setGoals((prev) => prev.filter((g) => g.id !== id));

    try {
      await supabase.from("goals").update({ status: "deleted" }).eq("id", id);
      if (goalToDelete) {
        await logGoalDeleted(goalToDelete);
      }
    } catch (err) {
      console.error("Failed to delete goal:", err);
    }
  };

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    console.log("=== DRAG END ===");
    console.log("Active ID:", active.id);
    console.log("Over ID:", over?.id);

    if (!over) {
      setActiveId(null);
      return;
    }

    const goalId = active.id as string;
    const overId = over.id as string;

    const draggedGoal = goals.find((g) => g.id === goalId);
    const overGoal = goals.find((g) => g.id === overId);

    console.log("Dragged Goal:", draggedGoal?.text, {
      period: draggedGoal?.period,
      isRecurring: draggedGoal?.isRecurring,
      specificPeriod: draggedGoal?.specificPeriod,
      position: draggedGoal?.position,
    });
    console.log("Over Goal:", overGoal?.text, {
      period: overGoal?.period,
      isRecurring: overGoal?.isRecurring,
      specificPeriod: overGoal?.specificPeriod,
      position: overGoal?.position,
    });

    if (!draggedGoal) {
      console.log("No dragged goal found");
      setActiveId(null);
      return;
    }

    // Check if dropping on another goal (reordering)
    if (overGoal && draggedGoal.period === overGoal.period) {
      console.log("Dropping on another goal in same period");
      // Check if they're in the same group (recurring/specific period)
      const sameGroup =
        draggedGoal.isRecurring === overGoal.isRecurring &&
        draggedGoal.specificPeriod === overGoal.specificPeriod;

      console.log("Same group?", sameGroup);

      if (sameGroup) {
        // Reordering within the same group
        // Filter to get only goals in this specific group
        const groupGoals = goals
          .filter(
            (g) =>
              g.period === draggedGoal.period &&
              g.isRecurring === draggedGoal.isRecurring &&
              g.specificPeriod === draggedGoal.specificPeriod &&
              g.status !== "deleted"
          )
          .sort((a, b) => a.position - b.position);

        console.log("Group goals count:", groupGoals.length);
        console.log(
          "Group goals:",
          groupGoals.map((g) => ({ text: g.text, position: g.position }))
        );

        const oldIndex = groupGoals.findIndex((g) => g.id === goalId);
        const newIndex = groupGoals.findIndex((g) => g.id === overId);

        console.log("Old index:", oldIndex, "New index:", newIndex);

        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          console.log("Reordering from", oldIndex, "to", newIndex);
          const reorderedGroupGoals = arrayMove(groupGoals, oldIndex, newIndex);

          console.log(
            "Reordered goals:",
            reorderedGroupGoals.map((g) => g.text)
          );

          // Create a completely new goals array with updated positions
          const updatedGoals = goals.map((goal) => {
            // Find if this goal is in the reordered group
            const reorderedIndex = reorderedGroupGoals.findIndex(
              (g) => g.id === goal.id
            );

            if (reorderedIndex !== -1) {
              // This goal is in the reordered group - update its position
              return {
                ...goal,
                position: reorderedIndex,
              };
            }

            // This goal is not in the reordered group - keep it as is
            return goal;
          });

          console.log("Setting updated goals");
          console.log("Goals before update:", goals.length);
          console.log("Updated goals:", updatedGoals.length);
          console.log(
            "Updated goals sample:",
            updatedGoals
              .slice(0, 3)
              .map((g) => ({ text: g.text, position: g.position }))
          );

          // Update local state IMMEDIATELY for instant UI feedback
          setGoals(updatedGoals);
          console.log("State updated successfully");

          // Update positions in database in the background
          try {
            const updates = reorderedGroupGoals.map((goal, index) => ({
              id: goal.id,
              position: index,
            }));

            console.log("Updating database with:", updates);

            // Update all positions in parallel
            await Promise.all(
              updates.map((update) =>
                supabase
                  .from("goals")
                  .update({ position: update.position })
                  .eq("id", update.id)
              )
            );
            console.log("Database updated successfully");
          } catch (err) {
            console.error("Failed to update goal positions:", err);
          }
        } else {
          console.log("Not reordering - indices invalid or same");
        }
      } else {
        console.log("Not same group - not reordering");
      }
    } else {
      console.log(
        "Not dropping on goal in same period - checking for column change"
      );
      // Check if dropping on a column (changing period)
      const targetColumnId = overId;
      let targetPeriod: "yearly" | "quarterly" | "monthly" | "daily" | null =
        null;

      if (targetColumnId.includes("yearly")) targetPeriod = "yearly";
      else if (targetColumnId.includes("quarterly")) targetPeriod = "quarterly";
      else if (targetColumnId.includes("monthly")) targetPeriod = "monthly";
      else if (targetColumnId.includes("daily")) targetPeriod = "daily";

      if (targetPeriod && targetPeriod !== draggedGoal.period) {
        // Changing period - update goal
        await handleUpdateGoal(goalId, { period: targetPeriod });
      }
    }

    setActiveId(null);
  };

  const activeGoal = goals.find((goal) => goal.id === activeId);

  // Droppable column wrapper
  const DroppableColumn = ({
    id,
    children,
    className = "",
  }: {
    id: string;
    children: React.ReactNode;
    className?: string;
  }) => {
    const { setNodeRef, isOver } = useDroppable({ id });
    return (
      <div
        ref={setNodeRef}
        className={`border-2 rounded-lg p-4 h-full transition-all duration-200 ${
          isOver ? "border-blue-400 bg-blue-50" : "bg-white border-gray-300"
        } hover:border-gray-400 ${className}`}
      >
        {children}
      </div>
    );
  };

  return (
    <div className="h-screen bg-gray-50 overflow-hidden flex flex-col">
      {/* Combined Header with View Switcher and Title */}
      <div className="bg-gray-50 py-2 flex justify-center pointer-events-none mb-4">
        <div className="bg-white border-2 border-gray-200 rounded-lg shadow-sm pointer-events-auto">
          {/* View Switcher - Top Layer */}
          <div className="flex items-center px-2 py-2">
            <button
              onClick={() => onViewChange?.("todos")}
              className="flex-1 px-3 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-gray-700 hover:bg-gray-50 z-50 relative"
              title="Weekly Planner"
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
            >
              <Calendar className="w-4 h-4 pointer-events-none" />
              <span className="text-sm font-medium">Weekly Planner</span>
            </button>
            <button
              onClick={() => onViewChange?.("goals")}
              className="flex-1 px-3 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-2 bg-blue-600 text-white z-50 relative"
              title="Goals"
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
            >
              <Target className="w-4 h-4 pointer-events-none" />
              <span className="text-sm font-medium">Goals</span>
            </button>
          </div>

          {/* Thin Horizontal Divider */}
          <div className="h-px bg-gray-300 mx-2"></div>

          {/* Title and Description - Bottom Layer */}
          <div className="flex items-center justify-center px-4 py-2.5">
            <p className="text-sm text-gray-600">
              Plan your future across different time horizons
            </p>
          </div>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 px-4 sm:px-6 lg:px-8 pb-4">
          <div className="grid grid-cols-4 gap-4 h-[calc(100vh-200px)]">
            {/* Yearly Column - Simple */}
            <DroppableColumn id="yearly-column" className="flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-800">Yearly</h2>
                <button
                  onClick={() => handleCreateGoal("yearly")}
                  className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title="Add yearly goal"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              <SortableContext
                items={yearlyGoals.map((g) => g.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3 overflow-y-auto">
                  {yearlyGoals.map((goal) => (
                    <GoalCard
                      key={goal.id}
                      goal={goal}
                      onUpdate={handleUpdateGoal}
                      onDelete={handleDeleteGoal}
                      isDragging={activeId === goal.id}
                    />
                  ))}
                </div>
              </SortableContext>
            </DroppableColumn>

            {/* Quarterly Column - Dual Section */}
            <DroppableColumn
              id="quarterly-column"
              className="flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <h2 className="text-lg font-semibold text-gray-800">
                  Quarterly
                </h2>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4">
                {/* Recurring Section */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Repeat className="w-4 h-4 text-blue-600" />
                      <h3 className="font-semibold text-sm text-blue-900">
                        Recurring
                      </h3>
                    </div>
                    <button
                      onClick={() => handleCreateGoal("quarterly")}
                      className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                      title="Add recurring quarterly goal"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <SortableContext
                    items={quarterlyRecurringGoals.map((g) => g.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {quarterlyRecurringGoals.map((goal) => (
                        <GoalCard
                          key={goal.id}
                          goal={goal}
                          onUpdate={handleUpdateGoal}
                          onDelete={handleDeleteGoal}
                          isDragging={activeId === goal.id}
                          parentGoalText={getParentGoalText(goal.parentId)}
                        />
                      ))}
                      {quarterlyRecurringGoals.length === 0 && (
                        <p className="text-xs text-blue-600 py-2">
                          Goals that repeat every quarter
                        </p>
                      )}
                    </div>
                  </SortableContext>
                </div>

                {/* Specific Periods Section */}
                <div className="space-y-3">
                  {Object.keys(quarterlyByPeriod)
                    .sort()
                    .map((period) => {
                      const isCurrentPeriod = period === currentQuarterPeriod;
                      const isCollapsed = collapsedPeriods.has(period);
                      const periodGoals = quarterlyByPeriod[period];

                      return (
                        <div
                          key={period}
                          className={`border rounded-lg p-3 ${
                            isCurrentPeriod
                              ? "bg-green-50 border-green-300"
                              : "bg-white border-gray-200"
                          }`}
                        >
                          <div
                            className="flex items-center justify-between mb-2 cursor-pointer"
                            onClick={() => togglePeriodCollapse(period)}
                          >
                            <div className="flex items-center gap-2">
                              <h3
                                className={`font-semibold text-sm ${
                                  isCurrentPeriod
                                    ? "text-green-900"
                                    : "text-gray-800"
                                }`}
                              >
                                {period}
                                {isCurrentPeriod && (
                                  <span className="ml-2 text-xs bg-green-200 px-2 py-0.5 rounded">
                                    Current
                                  </span>
                                )}
                              </h3>
                            </div>
                            {isCollapsed ? (
                              <ChevronDown className="w-4 h-4 text-gray-500" />
                            ) : (
                              <ChevronUp className="w-4 h-4 text-gray-500" />
                            )}
                          </div>
                          {!isCollapsed && (
                            <SortableContext
                              items={periodGoals.map((g) => g.id)}
                              strategy={verticalListSortingStrategy}
                            >
                              <div className="space-y-2">
                                {periodGoals.map((goal) => (
                                  <GoalCard
                                    key={goal.id}
                                    goal={goal}
                                    onUpdate={handleUpdateGoal}
                                    onDelete={handleDeleteGoal}
                                    isDragging={activeId === goal.id}
                                    parentGoalText={getParentGoalText(
                                      goal.parentId
                                    )}
                                  />
                                ))}
                              </div>
                            </SortableContext>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </DroppableColumn>

            {/* Monthly Column - Dual Section */}
            <DroppableColumn
              id="monthly-column"
              className="flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <h2 className="text-lg font-semibold text-gray-800">Monthly</h2>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4">
                {/* Recurring Section */}
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Repeat className="w-4 h-4 text-purple-600" />
                      <h3 className="font-semibold text-sm text-purple-900">
                        Recurring
                      </h3>
                    </div>
                    <button
                      onClick={() => handleCreateGoal("monthly")}
                      className="p-1 text-purple-600 hover:bg-purple-100 rounded transition-colors"
                      title="Add recurring monthly goal"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <SortableContext
                    items={monthlyRecurringGoals.map((g) => g.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {monthlyRecurringGoals.map((goal) => (
                        <GoalCard
                          key={goal.id}
                          goal={goal}
                          onUpdate={handleUpdateGoal}
                          onDelete={handleDeleteGoal}
                          isDragging={activeId === goal.id}
                          parentGoalText={getParentGoalText(goal.parentId)}
                        />
                      ))}
                      {monthlyRecurringGoals.length === 0 && (
                        <p className="text-xs text-purple-600 py-2">
                          Goals that repeat every month
                        </p>
                      )}
                    </div>
                  </SortableContext>
                </div>

                {/* Specific Periods Section */}
                <div className="space-y-3">
                  {Object.keys(monthlyByPeriod)
                    .sort()
                    .map((period) => {
                      const isCurrentPeriod = period === currentMonthPeriod;
                      const isCollapsed = collapsedPeriods.has(period);
                      const periodGoals = monthlyByPeriod[period];

                      // Format period label - parse components to avoid timezone issues
                      const [year, month] = period.split("-").map(Number);
                      const periodDate = new Date(year, month - 1, 1);
                      const periodLabel = periodDate.toLocaleDateString(
                        "en-US",
                        {
                          year: "numeric",
                          month: "long",
                        }
                      );

                      return (
                        <div
                          key={period}
                          className={`border rounded-lg p-3 ${
                            isCurrentPeriod
                              ? "bg-green-50 border-green-300"
                              : "bg-white border-gray-200"
                          }`}
                        >
                          <div
                            className="flex items-center justify-between mb-2 cursor-pointer"
                            onClick={() => togglePeriodCollapse(period)}
                          >
                            <div className="flex items-center gap-2">
                              <h3
                                className={`font-semibold text-sm ${
                                  isCurrentPeriod
                                    ? "text-green-900"
                                    : "text-gray-800"
                                }`}
                              >
                                {periodLabel}
                                {isCurrentPeriod && (
                                  <span className="ml-2 text-xs bg-green-200 px-2 py-0.5 rounded">
                                    Current
                                  </span>
                                )}
                              </h3>
                            </div>
                            {isCollapsed ? (
                              <ChevronDown className="w-4 h-4 text-gray-500" />
                            ) : (
                              <ChevronUp className="w-4 h-4 text-gray-500" />
                            )}
                          </div>
                          {!isCollapsed && (
                            <SortableContext
                              items={periodGoals.map((g) => g.id)}
                              strategy={verticalListSortingStrategy}
                            >
                              <div className="space-y-2">
                                {periodGoals.map((goal) => (
                                  <GoalCard
                                    key={goal.id}
                                    goal={goal}
                                    onUpdate={handleUpdateGoal}
                                    onDelete={handleDeleteGoal}
                                    isDragging={activeId === goal.id}
                                    parentGoalText={getParentGoalText(
                                      goal.parentId
                                    )}
                                  />
                                ))}
                              </div>
                            </SortableContext>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </DroppableColumn>

            {/* Daily Column - Dual Section */}
            <DroppableColumn
              id="daily-column"
              className="flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <h2 className="text-lg font-semibold text-gray-800">Daily</h2>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4">
                {/* Recurring Section */}
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Repeat className="w-4 h-4 text-purple-600" />
                      <h3 className="font-semibold text-sm text-purple-900">
                        Recurring
                      </h3>
                    </div>
                    <button
                      onClick={() => handleCreateGoal("daily")}
                      className="p-1 text-purple-600 hover:bg-purple-100 rounded transition-colors"
                      title="Add recurring daily goal"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <SortableContext
                    items={dailyRecurringGoals.map((g) => g.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {dailyRecurringGoals.map((goal) => (
                        <GoalCard
                          key={goal.id}
                          goal={goal}
                          onUpdate={handleUpdateGoal}
                          onDelete={handleDeleteGoal}
                          isDragging={activeId === goal.id}
                          parentGoalText={getParentGoalText(goal.parentId)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </div>

                {/* Specific Days Section */}
                <div className="space-y-2">
                  {Object.entries(dailyByPeriod)
                    .sort(([a], [b]) => b.localeCompare(a))
                    .map(([period, periodGoals]) => {
                      const isCurrentDay = period === currentDay;
                      const isCollapsed = collapsedPeriods.has(period);
                      // Parse date components directly to avoid timezone issues
                      const [year, month, day] = period.split("-").map(Number);
                      const periodDate = new Date(year, month - 1, day);
                      const periodLabel = format(periodDate, "MMM d, yyyy");

                      return (
                        <div
                          key={period}
                          className={`border rounded-lg p-3 ${
                            isCurrentDay
                              ? "bg-green-50 border-green-300"
                              : "bg-white border-gray-200"
                          }`}
                        >
                          <div
                            className="flex items-center justify-between mb-2 cursor-pointer"
                            onClick={() => togglePeriodCollapse(period)}
                          >
                            <div className="flex items-center gap-2">
                              <h3
                                className={`font-semibold text-sm ${
                                  isCurrentDay
                                    ? "text-green-900"
                                    : "text-gray-800"
                                }`}
                              >
                                {periodLabel}
                                {isCurrentDay && (
                                  <span className="ml-2 text-xs bg-green-200 px-2 py-0.5 rounded">
                                    Today
                                  </span>
                                )}
                              </h3>
                            </div>
                            {isCollapsed ? (
                              <ChevronDown className="w-4 h-4 text-gray-500" />
                            ) : (
                              <ChevronUp className="w-4 h-4 text-gray-500" />
                            )}
                          </div>
                          {!isCollapsed && (
                            <SortableContext
                              items={periodGoals.map((g) => g.id)}
                              strategy={verticalListSortingStrategy}
                            >
                              <div className="space-y-2">
                                {periodGoals.map((goal) => (
                                  <GoalCard
                                    key={goal.id}
                                    goal={goal}
                                    onUpdate={handleUpdateGoal}
                                    onDelete={handleDeleteGoal}
                                    isDragging={activeId === goal.id}
                                    parentGoalText={getParentGoalText(
                                      goal.parentId
                                    )}
                                  />
                                ))}
                              </div>
                            </SortableContext>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </DroppableColumn>
          </div>
        </div>

        <DragOverlay>
          {activeId && activeGoal ? (
            <GoalCard
              goal={activeGoal}
              onUpdate={() => {}}
              onDelete={() => {}}
              isDragging
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Goal Input Modal */}
      <GoalInput
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingGoal(null);
        }}
        onSave={handleSaveGoal}
        goal={editingGoal}
        availableParentGoals={goals.filter((g) => g.status === "active")}
        defaultPeriod={defaultPeriod}
      />
    </div>
  );
}
