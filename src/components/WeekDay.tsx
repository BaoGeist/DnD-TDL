"use client";

import { useDroppable } from "@dnd-kit/core";
import { TodoItem } from "./TodoItem";
import { Todo } from "./DragDropTodoList";

interface WeekDayProps {
  id: string;
  name: string;
  date?: string;
  todos: Todo[];
  onToggleTodo: (id: string) => void;
  onDeleteTodo: (id: string) => void;
  isUnassigned?: boolean;
}

export function WeekDay({
  id,
  name,
  date,
  todos,
  onToggleTodo,
  onDeleteTodo,
  isUnassigned = false,
}: WeekDayProps) {
  const { isOver, setNodeRef } = useDroppable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`
        bg-white rounded-lg border-2 p-4 min-h-[200px]
        ${isOver ? "border-blue-400 bg-blue-50" : "border-gray-200"}
        ${isUnassigned ? "bg-gray-50 border-dashed" : ""}
        transition-all duration-200
      `}
    >
      <div className="mb-4">
        <h3
          className={`font-semibold ${
            isUnassigned ? "text-gray-600" : "text-gray-800"
          }`}
        >
          {name}
        </h3>
        {date && <p className="text-sm text-gray-500">{date}</p>}
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-500">
            {todos.length} task{todos.length !== 1 ? "s" : ""}
          </span>
          {todos.filter((todo) => todo.completed).length > 0 && (
            <span className="text-xs text-green-600">
              {todos.filter((todo) => todo.completed).length} completed
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {todos.length === 0 ? (
          <div
            className={`
            text-center py-8 text-sm
            ${isUnassigned ? "text-gray-500" : "text-gray-400"}
          `}
          >
            {isUnassigned
              ? "Add new tasks here"
              : "Drop tasks here to schedule them"}
          </div>
        ) : (
          todos.map((todo) => (
            <TodoItem
              key={todo.id}
              todo={todo}
              onToggle={onToggleTodo}
              onDelete={onDeleteTodo}
            />
          ))
        )}
      </div>
    </div>
  );
}
