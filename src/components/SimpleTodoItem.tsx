"use client";

import { useDraggable } from "@dnd-kit/core";
import { Todo } from "./DragDropTodoList";
import { Trash2 } from "lucide-react";

interface SimpleTodoItemProps {
  todo: Todo;
  onUpdate: (id: string, updates: Partial<Todo>) => void;
  onDelete: (id: string) => void;
}

export function SimpleTodoItem({
  todo,
  onUpdate,
  onDelete,
}: SimpleTodoItemProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: todo.id,
    });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const handleToggleComplete = () => {
    onUpdate(todo.id, { status: todo.status === 'completed' ? 'active' : 'completed' });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        group flex items-center justify-between p-2 rounded border cursor-pointer
        ${
          todo.status === 'completed'
            ? "bg-green-50 border-green-200 text-green-800"
            : "bg-gray-50 border-gray-200 text-gray-900"
        }
        ${isDragging ? "opacity-50 shadow-lg" : ""}
        hover:shadow-sm transition-all duration-200
      `}
      data-todo-item
    >
      <div
        {...attributes}
        {...listeners}
        className="flex-1 cursor-grab active:cursor-grabbing"
        onClick={handleToggleComplete}
      >
        <div
          className={`text-sm font-medium ${
            todo.status === 'completed' ? "line-through" : ""
          }`}
        >
          {todo.text || "Untitled task"}
        </div>
        <div className="text-xs text-gray-500">{todo.estimatedHours}h</div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(todo.id);
        }}
        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all duration-200 p-1"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}
