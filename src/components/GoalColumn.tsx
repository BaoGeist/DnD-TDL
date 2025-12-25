"use client";

import { useDroppable } from "@dnd-kit/core";
import { Goal } from "@/utils/goalsHistoryLogger";

interface GoalColumnProps {
  id: string;
  title: string;
  subtitle: string;
  goals: Goal[];
  period: "yearly" | "quarterly" | "monthly";
}

export function GoalColumn({ id, title, subtitle, goals }: GoalColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id,
  });

  const activeGoals = goals.filter((goal) => goal.status === "active");
  const completedGoals = goals.filter((goal) => goal.status === "completed");

  return (
    <div
      ref={setNodeRef}
      className={`
        border-2 rounded-lg p-4 h-full transition-all duration-200
        ${isOver ? "border-blue-400 bg-blue-50" : "bg-white border-gray-300"}
        hover:border-gray-400
      `}
    >
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
        <p className="text-sm text-gray-500">{subtitle}</p>
        <div className="flex gap-4 text-xs text-gray-600 mt-2">
          <span>{activeGoals.length} active</span>
          {completedGoals.length > 0 && (
            <span className="text-green-600">
              ✓ {completedGoals.length} completed
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3 max-h-[calc(100vh-250px)] overflow-y-auto">
        {/* Goals will be rendered here by parent component */}
      </div>
    </div>
  );
}
