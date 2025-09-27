"use client";

import { useState, useRef, useEffect } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Todo } from "./DragDropTodoList";

interface CanvasTodoItemProps {
  todo: Todo;
  onUpdate: (id: string, updates: Partial<Todo>) => void;
  onDelete: (id: string) => void;
  isDragging?: boolean;
  isOverlay?: boolean;
  isAnimating?: boolean;
}

// Helper function to check if todo is in an assigned section (incomplete section or day of week)
const isInAssignedSection = (todo: Todo): boolean => {
  // If it has a dayOfWeek, it's definitely assigned
  if (todo.dayOfWeek) return true;

  // Check if positioned in incomplete section by checking if Y position suggests it's in a day area
  // Tasks in day areas typically have Y > 50 (below headers)
  return todo.position.y > 50;
};

export function CanvasTodoItem({
  todo,
  onUpdate,
  onDelete,
  isDragging = false,
  isOverlay = false,
  isAnimating = false,
}: CanvasTodoItemProps) {
  const [isEditingText, setIsEditingText] = useState(todo.isEditing || false);
  const [isEditingHours, setIsEditingHours] = useState(false);
  const [tempText, setTempText] = useState(todo.text);
  const [tempHours, setTempHours] = useState(todo.estimatedHours.toString());

  const textInputRef = useRef<HTMLInputElement>(null);
  const hoursInputRef = useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging: isDraggedItem,
  } = useDraggable({
    id: todo.id,
    disabled: isEditingText || isEditingHours,
  });

  const style = !isOverlay
    ? {
        position: "absolute" as const,
        left: todo.position.x,
        top: todo.position.y,
        pointerEvents: "auto" as const,
      }
    : {
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
      };

  useEffect(() => {
    if (isEditingText && textInputRef.current) {
      textInputRef.current.focus();
      textInputRef.current.select();
    }
  }, [isEditingText]);

  useEffect(() => {
    if (isEditingHours && hoursInputRef.current) {
      hoursInputRef.current.focus();
      hoursInputRef.current.select();
    }
  }, [isEditingHours]);

  const handleTextSubmit = () => {
    if (tempText.trim()) {
      onUpdate(todo.id, { text: tempText.trim(), isEditing: false });
      setIsEditingText(false);
    } else {
      onDelete(todo.id);
    }
  };

  const handleHoursSubmit = () => {
    const hours = parseFloat(tempHours);
    if (!isNaN(hours) && hours > 0) {
      onUpdate(todo.id, { estimatedHours: hours });
    }
    setIsEditingHours(false);
  };

  const handleTextKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleTextSubmit();
    } else if (e.key === "Tab") {
      e.preventDefault();
      handleTextSubmit();
      setIsEditingHours(true);
    } else if (e.key === "Escape") {
      setTempText(todo.text);
      setIsEditingText(false);
      if (!todo.text) onDelete(todo.id);
    }
  };

  const handleHoursKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      handleHoursSubmit();
    } else if (e.key === "Escape") {
      setTempHours(todo.estimatedHours.toString());
      setIsEditingHours(false);
    }
  };

  const handleToggleComplete = () => {
    onUpdate(todo.id, { completed: !todo.completed });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-todo-item
      title={`${todo.text} (${todo.estimatedHours}h)`}
      className={`
        inline-block px-2 py-1 rounded shadow-sm cursor-pointer select-none text-xs
        ${isDraggedItem ? "opacity-0" : "opacity-100"}
        ${isDragging ? "shadow-lg z-50" : ""}
        ${isAnimating ? "animate-bounce" : ""}
        ${
          todo.completed
            ? "bg-green-100 text-green-800 line-through"
            : isInAssignedSection(todo)
            ? "bg-blue-100 text-blue-800"
            : "bg-white text-gray-900"
        }
        border border-gray-200
        transition-opacity duration-200 hover:shadow-md
      `}
      {...attributes}
      {...listeners}
    >
      {isEditingText ? (
        <input
          ref={textInputRef}
          type="text"
          value={tempText}
          onChange={(e) => setTempText(e.target.value)}
          onBlur={handleTextSubmit}
          onKeyDown={handleTextKeyDown}
          onClick={(e) => e.stopPropagation()}
          className="bg-transparent border-none outline-none w-[160px] text-xs"
          placeholder="Enter task..."
        />
      ) : isEditingHours ? (
        <div className="flex items-center gap-1">
          <span className="text-xs">{todo.text}</span>
          <span className="text-xs">(</span>
          <input
            ref={hoursInputRef}
            type="number"
            step="0.5"
            min="0"
            value={tempHours}
            onChange={(e) => setTempHours(e.target.value)}
            onBlur={handleHoursSubmit}
            onKeyDown={handleHoursKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="w-8 text-xs border border-gray-300 rounded px-1 bg-white"
          />
          <span className="text-xs">h)</span>
        </div>
      ) : (
        <div
          onClick={(e) => {
            e.stopPropagation();
            if (e.detail === 2) {
              // Double click to edit
              setIsEditingText(true);
            } else {
              // Single click to toggle complete
              handleToggleComplete();
            }
          }}
          className="w-[160px] truncate text-xs"
        >
          {todo.text || "Click to add task..."} ({todo.estimatedHours}h)
        </div>
      )}
    </div>
  );
}
