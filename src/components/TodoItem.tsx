"use client";

import { useDraggable } from "@dnd-kit/core";
import { GripVertical, Trash2, Check } from "lucide-react";
import { Todo } from "./DragDropTodoList";

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  isDragging?: boolean;
}

export function TodoItem({
  todo,
  onToggle,
  onDelete,
  isDragging = false,
}: TodoItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging: isDraggedItem,
  } = useDraggable({
    id: todo.id,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        bg-white border border-gray-200 rounded-lg p-3 mb-2 shadow-sm
        ${isDraggedItem ? "opacity-50" : ""}
        ${isDragging ? "rotate-3 shadow-lg" : ""}
        transition-all duration-200 hover:shadow-md
      `}
    >
      <div className="flex items-center gap-3">
        <button
          {...attributes}
          {...listeners}
          className="text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
          aria-label="Drag to move task"
        >
          <GripVertical size={16} />
        </button>

        <button
          onClick={() => onToggle(todo.id)}
          className={`
            flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center
            ${
              todo.status === "completed"
                ? "bg-green-500 border-green-500 text-white"
                : "border-gray-300 hover:border-gray-400"
            }
            transition-colors
          `}
          aria-label={
            todo.status === "completed"
              ? "Mark as incomplete"
              : "Mark as complete"
          }
        >
          {todo.status === "completed" && <Check size={12} />}
        </button>

        <span
          className={`
            flex-1 text-xs
            ${
              todo.status === "completed"
                ? "text-gray-500 line-through"
                : "text-gray-900"
            }
          `}
        >
          {todo.text}
        </span>

        <button
          onClick={() => onDelete(todo.id)}
          className="text-gray-400 hover:text-red-500 transition-colors"
          aria-label="Delete task"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
