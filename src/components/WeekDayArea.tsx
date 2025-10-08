"use client";

import { useDroppable } from "@dnd-kit/core";
import { Todo } from "./DragDropTodoList";

interface WeekDayAreaProps {
  id: string;
  name: string;
  date: string;
  todos: Todo[];
  isToday?: boolean;
}

export function WeekDayArea({
  id,
  name,
  date,
  todos,
  isToday = false,
}: WeekDayAreaProps) {
  const { isOver, setNodeRef } = useDroppable({
    id,
  });

  const totalHours = todos.reduce((sum, todo) => sum + todo.estimatedHours, 0);
  const completedTodos = todos.filter(
    (todo) => todo.status === "completed"
  ).length;
  const remainingHours =
    totalHours -
    todos
      .filter((todo) => todo.status === "completed")
      .reduce((sum, todo) => sum + todo.estimatedHours, 0);

  return (
    <div
      ref={setNodeRef}
      data-day-area={id}
      className={`
        border-2 rounded-lg p-4 h-full transition-all duration-200
        ${isOver ? "border-blue-400 bg-blue-50" : "bg-white border-gray-300"}
        hover:border-gray-400
      `}
    >
      <div className="mb-3">
        <div className="flex flex-row justify-between items-baseline">
          <h3
            className={`font-semibold text-lg ${
              isToday ? "text-blue-600" : "text-gray-800"
            }`}
          >
            {name}
          </h3>
          <p className="text-sm text-gray-500">{date}</p>
        </div>

        <div className="flex justify-between text-xs text-gray-600 mt-1">
          <span>
            {todos.length} task{todos.length !== 1 ? "s" : ""}
          </span>
          <span>{remainingHours}h remaining</span>
        </div>

        {completedTodos > 0 && (
          <div className="text-xs text-green-600 mt-1">
            ✓ {completedTodos} completed
          </div>
        )}
      </div>

      <div className="space-y-2 max-h-[calc(100%-80px)] overflow-y-auto">
        {/* Empty space for visual feedback during drag */}
      </div>
    </div>
  );
}
