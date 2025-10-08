"use client";

import { useState, useEffect } from "react";
import { format, addDays, startOfWeek } from "date-fns";
import { Todo } from "./DragDropTodoList";

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: {
    text: string;
    estimatedHours: number;
    scheduledDate: Date | null;
    dayOfWeek: string | null;
  }) => void;
  todo?: Todo | null; // If provided, we're editing; otherwise creating
  currentWeekStart: Date;
}

export function TaskModal({
  isOpen,
  onClose,
  onSave,
  todo,
  currentWeekStart,
}: TaskModalProps) {
  const [taskName, setTaskName] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("1");
  const [selectedDay, setSelectedDay] = useState<string>("backlog");

  // Initialize form with todo data if editing
  useEffect(() => {
    if (todo) {
      setTaskName(todo.text);
      setEstimatedHours(todo.estimatedHours.toString());
      if (todo.dayOfWeek === "backlog") {
        setSelectedDay("backlog");
      } else if (todo.dayOfWeek === null && !todo.scheduledDate) {
        setSelectedDay("incomplete");
      } else if (todo.scheduledDate) {
        setSelectedDay(format(todo.scheduledDate, "EEEE"));
      } else {
        setSelectedDay("backlog");
      }
    } else {
      // Reset for new task
      setTaskName("");
      setEstimatedHours("1");
      setSelectedDay("backlog");
    }
  }, [todo, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!taskName.trim()) return;

    const hours = parseFloat(estimatedHours);
    if (isNaN(hours) || hours <= 0) return;

    let scheduledDate: Date | null = null;
    let dayOfWeek: string | null = null;

    if (selectedDay === "backlog") {
      dayOfWeek = "backlog";
      scheduledDate = null;
    } else if (selectedDay === "incomplete") {
      dayOfWeek = null;
      scheduledDate = null;
    } else {
      // Find the date for the selected day
      const weekDays = Array.from({ length: 7 }, (_, i) => {
        const date = addDays(currentWeekStart, i);
        return {
          name: format(date, "EEEE"),
          date: date,
        };
      });
      const selectedDayData = weekDays.find((d) => d.name === selectedDay);
      if (selectedDayData) {
        scheduledDate = selectedDayData.date;
        dayOfWeek = selectedDay;
      }
    }

    onSave({
      text: taskName.trim(),
      estimatedHours: hours,
      scheduledDate,
      dayOfWeek,
    });

    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Generate day options based on current week
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = startOfWeek(today, { weekStartsOn: 0 }); // Start on Sunday
  const dayOptions = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    return {
      name: format(date, "EEEE"),
      date: format(date, "MMM d"),
    };
  });

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50"
      onClick={handleBackdropClick}
    >
      {/* Bottom sheet */}
      <div
        className="bg-white rounded-t-2xl w-full max-w-lg max-h-[85vh] flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div
          className="pt-3 pb-2 flex justify-center cursor-pointer"
          onClick={onClose}
        >
          <div className="w-12 h-1.5 bg-gray-300 rounded-full"></div>
        </div>

        {/* Header */}
        <div className="flex-shrink-0 px-6 pt-2 pb-4 flex items-center justify-between border-b border-gray-200">
          <h2 className="text-xl font-semibold">
            {todo ? "Edit Task" : "Create Task"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Task Name */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Task Name
            </label>
            <input
              type="text"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter task name..."
              autoFocus
            />
          </div>

          {/* Estimated Hours */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Estimated Hours
            </label>
            <input
              type="number"
              step="0.5"
              min="0"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Day Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Assign to Day
            </label>
            <div className="space-y-2">
              {/* Backlog option */}
              <button
                onClick={() => setSelectedDay("backlog")}
                className={`w-full px-4 py-3 rounded-lg border-2 text-left transition-colors ${
                  selectedDay === "backlog"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="font-medium">Backlog</div>
                <div className="text-xs text-gray-500">
                  Ideas & Future Projects
                </div>
              </button>

              {/* Week days */}
              {dayOptions.map((day) => (
                <button
                  key={day.name}
                  onClick={() => setSelectedDay(day.name)}
                  className={`w-full px-4 py-3 rounded-lg border-2 text-left transition-colors ${
                    selectedDay === day.name
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex justify-between">
                    <span className="font-medium">{day.name}</span>
                    <span className="text-sm text-gray-500">{day.date}</span>
                  </div>
                </button>
              ))}

              {/* Incomplete option */}
              <button
                onClick={() => setSelectedDay("incomplete")}
                className={`w-full px-4 py-3 rounded-lg border-2 text-left transition-colors ${
                  selectedDay === "incomplete"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="font-medium">Incomplete</div>
                <div className="text-xs text-gray-500">Carry Over</div>
              </button>
            </div>
          </div>
        </div>

        {/* Fixed Footer with Save Button */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 bg-white rounded-b-2xl">
          <button
            onClick={handleSave}
            disabled={!taskName.trim()}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {todo ? "Save Changes" : "Create Task"}
          </button>
        </div>
      </div>
    </div>
  );
}
