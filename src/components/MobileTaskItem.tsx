"use client";

import { useState, useRef, useEffect } from "react";
import { Todo } from "./DragDropTodoList";

interface MobileTaskItemProps {
  todo: Todo;
  onTap: (id: string) => void;
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
}

export function MobileTaskItem({
  todo,
  onTap,
  onToggleComplete,
  onDelete,
}: MobileTaskItemProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isPressing = useRef(false);

  const handleTouchStart = () => {
    isPressing.current = true;
    longPressTimerRef.current = setTimeout(() => {
      if (isPressing.current) {
        setShowDeleteConfirm(true);
      }
    }, 500); // 500ms for long press
  };

  const handleTouchEnd = () => {
    isPressing.current = false;
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
  };

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  const handleConfirmDelete = () => {
    onDelete(todo.id);
    setShowDeleteConfirm(false);
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  return (
    <>
      <div className="flex items-center gap-3 py-3 px-4 bg-white border-b border-gray-200">
        {/* Task text - tap to edit */}
        <div
          className="flex-1 flex min-w-0 items-center"
          onClick={() => onTap(todo.id)}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchEnd}
        >
          <div
            className={`text-sm truncate ${
              todo.completed ? "line-through text-gray-500" : "text-gray-900"
            }`}
          >
            {todo.text || "Untitled task"}
          </div>
          <span
            className={`text-xs text-gray-500 ml-2 flex-shrink-0 ${
              todo.completed ? "line-through text-gray-500" : "text-gray-900"
            }`}
          >
            {todo.estimatedHours}h
          </span>
        </div>

        {/* Checkbox - tap to toggle complete */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleComplete(todo.id);
          }}
          className="flex-shrink-0 w-6 h-6 rounded border-2 border-gray-300 flex items-center justify-center"
        >
          {todo.completed && (
            <svg
              className="w-4 h-4 text-green-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 m-4 max-w-sm w-full">
            <h3 className="text-lg font-semibold mb-2">Delete Task?</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete &quot;{todo.text}&quot;?
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleCancelDelete}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
