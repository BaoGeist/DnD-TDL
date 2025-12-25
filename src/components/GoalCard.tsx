"use client";

import { useState, useRef, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, Link2, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Goal } from "@/utils/goalsHistoryLogger";

interface GoalCardProps {
  goal: Goal;
  onUpdate: (id: string, updates: Partial<Goal>) => void;
  onDelete: (id: string) => void;
  isDragging?: boolean;
  parentGoalText?: string | null;
}

export function GoalCard({
  goal,
  onUpdate,
  onDelete,
  isDragging = false,
  parentGoalText = null,
}: GoalCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempText, setTempText] = useState(goal.text);
  const [tempDescription, setTempDescription] = useState(
    goal.description || ""
  );
  const textInputRef = useRef<HTMLTextAreaElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: goal.id,
    disabled: isEditing,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1,
  };

  useEffect(() => {
    if (isEditing && textInputRef.current) {
      textInputRef.current.focus();
      textInputRef.current.select();
    }
  }, [isEditing]);

  const handleSubmit = () => {
    if (tempText.trim()) {
      onUpdate(goal.id, {
        text: tempText.trim(),
        description: tempDescription.trim() || undefined,
      });
      setIsEditing(false);
    } else {
      onDelete(goal.id);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.ctrlKey) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      setTempText(goal.text);
      setTempDescription(goal.description || "");
      setIsEditing(false);
    }
  };

  const handleToggleComplete = () => {
    const now = new Date();

    if (goal.isRecurring) {
      // For recurring goals, increment counter and add completion date
      onUpdate(goal.id, {
        completionCount: goal.completionCount + 1,
        completionDates: [...(goal.completionDates || []), now],
      });
    } else {
      // For non-recurring goals, toggle status and add/keep completion dates
      const newStatus = goal.status === "completed" ? "active" : "completed";
      onUpdate(goal.id, {
        status: newStatus,
        completionDates:
          newStatus === "completed"
            ? [...(goal.completionDates || []), now]
            : goal.completionDates, // Keep dates when unchecking
      });
    }
  };

  if (isEditing) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="bg-white border-2 border-blue-500 rounded-lg p-4 shadow-sm"
      >
        <textarea
          ref={textInputRef}
          value={tempText}
          onChange={(e) => setTempText(e.target.value)}
          onBlur={handleSubmit}
          onKeyDown={handleKeyDown}
          className="w-full text-sm font-medium text-gray-900 border-none outline-none resize-none mb-2"
          rows={2}
          placeholder="Goal title..."
        />
        <textarea
          value={tempDescription}
          onChange={(e) => setTempDescription(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full text-xs text-gray-600 border-none outline-none resize-none"
          rows={3}
          placeholder="Description (optional)..."
        />
        <div className="text-xs text-gray-400 mt-2">
          Ctrl+Enter to save, Esc to cancel
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        bg-white border rounded-lg p-4 shadow-sm cursor-move transition-all
        ${isDragging ? "opacity-50 scale-105" : "opacity-100"}
        ${
          goal.status === "completed"
            ? "bg-green-50 border-green-200"
            : "border-gray-200"
        }
        hover:shadow-md hover:border-gray-300
      `}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3
          className={`text-sm font-medium flex-1 ${
            goal.status === "completed"
              ? "line-through text-gray-500"
              : "text-gray-900"
          }`}
        >
          {goal.text}
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={handleToggleComplete}
            className={`p-1 rounded transition-colors ${
              goal.isRecurring
                ? "text-blue-600 hover:bg-blue-100"
                : goal.status === "completed"
                ? "text-green-600 hover:bg-green-100"
                : "text-gray-400 hover:bg-gray-100"
            }`}
            title={
              goal.isRecurring
                ? `Completed ${goal.completionCount} times - Click to increment`
                : goal.status === "completed"
                ? "Mark incomplete"
                : "Mark complete"
            }
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsEditing(true)}
            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="Edit goal"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            onClick={() => onDelete(goal.id)}
            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title="Delete goal"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {goal.description && (
        <p className="text-xs text-gray-600 mb-2 line-clamp-2">
          {goal.description}
        </p>
      )}

      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-2">
          {goal.period === "yearly" && goal.targetDate && (
            <span>{format(goal.targetDate, "MMM yyyy")}</span>
          )}
          {goal.isRecurring && goal.completionCount > 0 && (
            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              {goal.completionCount}x
            </span>
          )}
        </div>
        {parentGoalText && (
          <div className="flex items-center gap-1 text-blue-600">
            <Link2 className="w-3 h-3" />
            <span className="truncate max-w-[100px]">{parentGoalText}</span>
          </div>
        )}
      </div>
    </div>
  );
}
