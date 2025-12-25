"use client";

import { useState, useEffect } from "react";
import { Plus, Repeat, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import {
  Goal,
  logGoalCreated,
  logGoalUpdated,
  logGoalDeleted,
} from "@/utils/goalsHistoryLogger";
import { GoalInput } from "./GoalInput";
import { supabase } from "@/utils/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";

export function MobileGoals() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [activeTab, setActiveTab] = useState<
    "yearly" | "quarterly" | "monthly" | "daily"
  >("monthly");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [collapsedPeriods, setCollapsedPeriods] = useState<Set<string>>(
    new Set()
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

  // Get current quarter, month, and day for highlighting
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);
  const currentMonth = (now.getMonth() + 1).toString().padStart(2, "0");
  const currentDay = now.toISOString().split("T")[0]; // Format: "YYYY-MM-DD"
  const currentQuarterPeriod = `${currentYear}-Q${currentQuarter}`;
  const currentMonthPeriod = `${currentYear}-${currentMonth}`;

  // Categorize goals
  const filteredGoals = goals.filter((goal) => goal.period === activeTab);
  const recurringGoals = filteredGoals.filter((goal) => goal.isRecurring);
  const specificGoals = filteredGoals.filter((goal) => !goal.isRecurring);

  // Group specific goals by period
  const goalsByPeriod = specificGoals.reduce((acc, goal) => {
    const period = goal.specificPeriod || "unspecified";
    if (!acc[period]) acc[period] = [];
    acc[period].push(goal);
    return acc;
  }, {} as Record<string, Goal[]>);

  // Toggle period collapse
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

  const handleCreateGoal = () => {
    setEditingGoal(null);
    setIsModalOpen(true);
  };

  const handleEditGoal = (goal: Goal) => {
    setEditingGoal(goal);
    setIsModalOpen(true);
  };

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
            completion_dates: [],
          },
        ]);

        await logGoalCreated(newGoal);
      } catch (err) {
        console.error("Failed to create goal:", err);
      }
    }
  };

  const handleToggleComplete = async (id: string) => {
    const goal = goals.find((g) => g.id === id);
    if (!goal) return;

    const now = new Date();

    if (goal.isRecurring) {
      // For recurring goals, increment counter and add completion date
      const updatedGoal: Goal = {
        ...goal,
        completionCount: goal.completionCount + 1,
        completionDates: [...(goal.completionDates || []), now],
      };

      setGoals((prev) => prev.map((g) => (g.id === id ? updatedGoal : g)));

      try {
        await supabase
          .from("goals")
          .update({
            completion_count: updatedGoal.completionCount,
            completion_dates: updatedGoal.completionDates.map((d) =>
              d.toISOString()
            ),
          })
          .eq("id", id);
        await logGoalUpdated(id, goal, updatedGoal);
      } catch (err) {
        console.error("Failed to update goal:", err);
      }
    } else {
      // For non-recurring goals, toggle status and add/keep completion dates
      const newStatus: "active" | "completed" =
        goal.status === "completed" ? "active" : "completed";
      const updatedGoal: Goal = {
        ...goal,
        status: newStatus,
        completionDates:
          newStatus === "completed"
            ? [...(goal.completionDates || []), now]
            : goal.completionDates, // Keep dates when unchecking
      };

      setGoals((prev) => prev.map((g) => (g.id === id ? updatedGoal : g)));

      try {
        await supabase
          .from("goals")
          .update({
            status: newStatus,
            completion_dates:
              updatedGoal.completionDates?.map((d) => d.toISOString()) || [],
          })
          .eq("id", id);
        await logGoalUpdated(id, goal, updatedGoal);
      } catch (err) {
        console.error("Failed to update goal:", err);
      }
    }
  };

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

  const getParentGoalText = (parentId: string | null): string | null => {
    if (!parentId) return null;
    const parent = goals.find((g) => g.id === parentId);
    return parent ? parent.text : null;
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900">Long Term Goals</h1>
          <p className="text-xs text-gray-500 mt-1">Plan your future</p>
        </div>

        {/* Tabs */}
        <div className="flex border-t border-gray-200">
          <button
            onClick={() => setActiveTab("yearly")}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === "yearly"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600"
            }`}
          >
            Yearly
          </button>
          <button
            onClick={() => setActiveTab("quarterly")}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === "quarterly"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600"
            }`}
          >
            Quarterly
          </button>
          <button
            onClick={() => setActiveTab("monthly")}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === "monthly"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setActiveTab("daily")}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === "daily"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600"
            }`}
          >
            Daily
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {/* Yearly Tab - Simple List */}
        {activeTab === "yearly" && (
          <div className="p-4 space-y-3">
            {filteredGoals.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p className="text-sm">No yearly goals yet</p>
                <button
                  onClick={handleCreateGoal}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
                >
                  Create your first yearly goal
                </button>
              </div>
            ) : (
              filteredGoals.map((goal) => {
                const parentText = getParentGoalText(goal.parentId);
                return (
                  <div
                    key={goal.id}
                    className={`bg-white rounded-lg p-4 shadow-sm border ${
                      goal.status === "completed"
                        ? "bg-green-50 border-green-200"
                        : "border-gray-200"
                    }`}
                    onClick={() => handleEditGoal(goal)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h3
                          className={`text-sm font-medium ${
                            goal.status === "completed"
                              ? "line-through text-gray-500"
                              : "text-gray-900"
                          }`}
                        >
                          {goal.text}
                        </h3>
                        {goal.description && (
                          <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                            {goal.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                          {goal.period === "yearly" && goal.targetDate && (
                            <span>{format(goal.targetDate, "MMM yyyy")}</span>
                          )}
                          {goal.isRecurring && goal.completionCount > 0 && (
                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                              {goal.completionCount}x
                            </span>
                          )}
                          {parentText && (
                            <span className="text-blue-600">
                              → {parentText}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleComplete(goal.id);
                        }}
                        className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          goal.isRecurring
                            ? "bg-blue-500 border-blue-500"
                            : goal.status === "completed"
                            ? "bg-green-500 border-green-500"
                            : "border-gray-300"
                        }`}
                      >
                        {(goal.isRecurring || goal.status === "completed") && (
                          <span className="text-white text-xs">✓</span>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Quarterly Tab - Dual Section */}
        {activeTab === "quarterly" && (
          <div className="p-4 space-y-4">
            {/* Recurring Section */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Repeat className="w-4 h-4 text-blue-600" />
                  <h3 className="font-semibold text-sm text-blue-900">
                    Recurring
                  </h3>
                </div>
                <button
                  onClick={handleCreateGoal}
                  className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2">
                {recurringGoals.length === 0 ? (
                  <p className="text-xs text-blue-600 py-2">
                    Goals that repeat every quarter
                  </p>
                ) : (
                  recurringGoals.map((goal) => (
                    <div
                      key={goal.id}
                      className={`bg-white rounded-lg p-3 shadow-sm border ${
                        goal.status === "completed"
                          ? "border-green-300"
                          : "border-blue-200"
                      }`}
                      onClick={() => handleEditGoal(goal)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <h3
                            className={`text-sm font-medium ${
                              goal.status === "completed"
                                ? "line-through text-gray-500"
                                : "text-gray-900"
                            }`}
                          >
                            {goal.text}
                          </h3>
                          {goal.description && (
                            <p className="text-xs text-gray-600 mt-1">
                              {goal.description}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleComplete(goal.id);
                          }}
                          className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                            goal.status === "completed"
                              ? "bg-green-500 border-green-500"
                              : "border-gray-300"
                          }`}
                        >
                          {goal.status === "completed" && (
                            <span className="text-white text-xs">✓</span>
                          )}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Specific Quarters Section */}
            <div className="space-y-3">
              {Object.keys(goalsByPeriod).length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-sm">No specific quarterly goals</p>
                </div>
              ) : (
                Object.keys(goalsByPeriod)
                  .sort()
                  .map((period) => {
                    const isCurrentPeriod = period === currentQuarterPeriod;
                    const isCollapsed = collapsedPeriods.has(period);
                    const periodGoals = goalsByPeriod[period];

                    return (
                      <div
                        key={period}
                        className={`border rounded-lg ${
                          isCurrentPeriod
                            ? "bg-green-50 border-green-300"
                            : "bg-white border-gray-200"
                        }`}
                      >
                        <div
                          className="flex items-center justify-between p-3 cursor-pointer"
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
                          <div className="px-3 pb-3 space-y-2">
                            {periodGoals.map((goal) => (
                              <div
                                key={goal.id}
                                className={`bg-white rounded-lg p-3 shadow-sm border ${
                                  goal.status === "completed"
                                    ? "border-green-300"
                                    : "border-gray-200"
                                }`}
                                onClick={() => handleEditGoal(goal)}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1">
                                    <h3
                                      className={`text-sm font-medium ${
                                        goal.status === "completed"
                                          ? "line-through text-gray-500"
                                          : "text-gray-900"
                                      }`}
                                    >
                                      {goal.text}
                                    </h3>
                                    {goal.description && (
                                      <p className="text-xs text-gray-600 mt-1">
                                        {goal.description}
                                      </p>
                                    )}
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleComplete(goal.id);
                                    }}
                                    className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                      goal.status === "completed"
                                        ? "bg-green-500 border-green-500"
                                        : "border-gray-300"
                                    }`}
                                  >
                                    {goal.status === "completed" && (
                                      <span className="text-white text-xs">
                                        ✓
                                      </span>
                                    )}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        )}

        {/* Monthly Tab - Dual Section */}
        {activeTab === "monthly" && (
          <div className="p-4 space-y-4">
            {/* Recurring Section */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Repeat className="w-4 h-4 text-purple-600" />
                  <h3 className="font-semibold text-sm text-purple-900">
                    Recurring
                  </h3>
                </div>
                <button
                  onClick={handleCreateGoal}
                  className="p-1 text-purple-600 hover:bg-purple-100 rounded"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2">
                {recurringGoals.length === 0 ? (
                  <p className="text-xs text-purple-600 py-2">
                    Goals that repeat every month
                  </p>
                ) : (
                  recurringGoals.map((goal) => (
                    <div
                      key={goal.id}
                      className={`bg-white rounded-lg p-3 shadow-sm border ${
                        goal.status === "completed"
                          ? "border-green-300"
                          : "border-purple-200"
                      }`}
                      onClick={() => handleEditGoal(goal)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <h3
                            className={`text-sm font-medium ${
                              goal.status === "completed"
                                ? "line-through text-gray-500"
                                : "text-gray-900"
                            }`}
                          >
                            {goal.text}
                          </h3>
                          {goal.description && (
                            <p className="text-xs text-gray-600 mt-1">
                              {goal.description}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleComplete(goal.id);
                          }}
                          className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                            goal.status === "completed"
                              ? "bg-green-500 border-green-500"
                              : "border-gray-300"
                          }`}
                        >
                          {goal.status === "completed" && (
                            <span className="text-white text-xs">✓</span>
                          )}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Specific Months Section */}
            <div className="space-y-3">
              {Object.keys(goalsByPeriod).length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-sm">No specific monthly goals</p>
                </div>
              ) : (
                Object.keys(goalsByPeriod)
                  .sort()
                  .map((period) => {
                    const isCurrentPeriod = period === currentMonthPeriod;
                    const isCollapsed = collapsedPeriods.has(period);
                    const periodGoals = goalsByPeriod[period];

                    // Format period label - parse components to avoid timezone issues
                    const [year, month] = period.split("-").map(Number);
                    const periodDate = new Date(year, month - 1, 1);
                    const periodLabel = periodDate.toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                    });

                    return (
                      <div
                        key={period}
                        className={`border rounded-lg ${
                          isCurrentPeriod
                            ? "bg-green-50 border-green-300"
                            : "bg-white border-gray-200"
                        }`}
                      >
                        <div
                          className="flex items-center justify-between p-3 cursor-pointer"
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
                          <div className="px-3 pb-3 space-y-2">
                            {periodGoals.map((goal) => (
                              <div
                                key={goal.id}
                                className={`bg-white rounded-lg p-3 shadow-sm border ${
                                  goal.status === "completed"
                                    ? "border-green-300"
                                    : "border-gray-200"
                                }`}
                                onClick={() => handleEditGoal(goal)}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1">
                                    <h3
                                      className={`text-sm font-medium ${
                                        goal.status === "completed"
                                          ? "line-through text-gray-500"
                                          : "text-gray-900"
                                      }`}
                                    >
                                      {goal.text}
                                    </h3>
                                    {goal.description && (
                                      <p className="text-xs text-gray-600 mt-1">
                                        {goal.description}
                                      </p>
                                    )}
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleComplete(goal.id);
                                    }}
                                    className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                      goal.status === "completed"
                                        ? "bg-green-500 border-green-500"
                                        : "border-gray-300"
                                    }`}
                                  >
                                    {goal.status === "completed" && (
                                      <span className="text-white text-xs">
                                        ✓
                                      </span>
                                    )}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        )}

        {/* Daily Tab - Recurring + Specific Days */}
        {activeTab === "daily" && (
          <div className="p-4 space-y-4">
            {/* Recurring Section */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Repeat className="w-4 h-4 text-purple-600" />
                  <h3 className="font-semibold text-sm text-purple-900">
                    Recurring
                  </h3>
                </div>
                <button
                  onClick={handleCreateGoal}
                  className="p-1 text-purple-600 hover:bg-purple-100 rounded"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2">
                {recurringGoals.length === 0 ? (
                  <p className="text-xs text-purple-600 py-2">
                    Goals that repeat every day
                  </p>
                ) : (
                  recurringGoals.map((goal) => (
                    <div
                      key={goal.id}
                      className={`bg-white rounded-lg p-3 shadow-sm border ${
                        goal.status === "completed"
                          ? "border-green-300"
                          : "border-purple-200"
                      }`}
                      onClick={() => handleEditGoal(goal)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <h3
                            className={`text-sm font-medium ${
                              goal.status === "completed"
                                ? "line-through text-gray-500"
                                : "text-gray-900"
                            }`}
                          >
                            {goal.text}
                          </h3>
                          {goal.description && (
                            <p className="text-xs text-gray-600 mt-1">
                              {goal.description}
                            </p>
                          )}
                          {goal.completionCount > 0 && (
                            <div className="mt-2">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                {goal.completionCount}x
                              </span>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleComplete(goal.id);
                          }}
                          className={`flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                            goal.isRecurring
                              ? "border-blue-500 hover:bg-blue-50"
                              : goal.status === "completed"
                              ? "bg-green-500 border-green-500"
                              : "border-gray-300 hover:border-gray-400"
                          }`}
                        >
                          {(goal.status === "completed" ||
                            goal.isRecurring) && (
                            <Check
                              className={`w-4 h-4 ${
                                goal.isRecurring
                                  ? "text-blue-500"
                                  : "text-white"
                              }`}
                            />
                          )}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Specific Days Section */}
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm text-gray-900">
                  Specific Days
                </h3>
                <button
                  onClick={handleCreateGoal}
                  className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                {Object.keys(goalsByPeriod).length === 0 ? (
                  <p className="text-xs text-gray-500 py-2">
                    No daily goals scheduled
                  </p>
                ) : (
                  Object.keys(goalsByPeriod)
                    .sort((a, b) => b.localeCompare(a)) // Sort descending (most recent first)
                    .map((period) => {
                      // Parse date components directly to avoid timezone issues
                      const [year, month, day] = period.split("-").map(Number);
                      const periodDate = new Date(year, month - 1, day);
                      const isToday = period === currentDay;
                      const isCollapsed = collapsedPeriods.has(period);

                      return (
                        <div key={period} className="space-y-2">
                          {/* Period Header */}
                          <button
                            onClick={() => togglePeriodCollapse(period)}
                            className={`w-full px-3 py-2 rounded-lg transition-colors text-left flex items-center justify-between ${
                              isToday
                                ? "bg-green-50 border border-green-300"
                                : "bg-gray-50 border border-gray-200"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-sm font-medium ${
                                  isToday ? "text-green-700" : "text-gray-700"
                                }`}
                              >
                                {format(periodDate, "MMM d, yyyy")}
                              </span>
                              {isToday && (
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                  Today
                                </span>
                              )}
                            </div>
                            <ChevronDown
                              className={`w-4 h-4 text-gray-500 transition-transform ${
                                isCollapsed ? "-rotate-90" : ""
                              }`}
                            />
                          </button>

                          {/* Period Goals */}
                          {!isCollapsed && (
                            <div className="space-y-2 pl-3">
                              {goalsByPeriod[period].map((goal) => (
                                <div
                                  key={goal.id}
                                  className={`bg-white rounded-lg p-3 shadow-sm border ${
                                    goal.status === "completed"
                                      ? "border-green-300"
                                      : "border-gray-200"
                                  }`}
                                  onClick={() => handleEditGoal(goal)}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1">
                                      <h3
                                        className={`text-sm font-medium ${
                                          goal.status === "completed"
                                            ? "line-through text-gray-500"
                                            : "text-gray-900"
                                        }`}
                                      >
                                        {goal.text}
                                      </h3>
                                      {goal.description && (
                                        <p className="text-xs text-gray-600 mt-1">
                                          {goal.description}
                                        </p>
                                      )}
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleComplete(goal.id);
                                      }}
                                      className={`flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                                        goal.status === "completed"
                                          ? "bg-green-500 border-green-500"
                                          : "border-gray-300 hover:border-gray-400"
                                      }`}
                                    >
                                      {goal.status === "completed" && (
                                        <Check className="w-4 h-4 text-white" />
                                      )}
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <button
        onClick={handleCreateGoal}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-700 transition-colors"
      >
        <Plus className="w-6 h-6" />
      </button>

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
        defaultPeriod={activeTab}
      />
    </div>
  );
}
