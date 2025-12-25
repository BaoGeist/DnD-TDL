"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { X } from "lucide-react";
import { Goal } from "@/utils/goalsHistoryLogger";

interface GoalInputProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (goal: {
    text: string;
    description?: string;
    period: "yearly" | "quarterly" | "monthly" | "daily";
    targetDate?: Date;
    parentId: string | null;
    isRecurring: boolean;
    specificPeriod: string | null;
  }) => void;
  goal?: Goal | null;
  availableParentGoals?: Goal[];
  defaultPeriod?: "yearly" | "quarterly" | "monthly" | "daily";
}

export function GoalInput({
  isOpen,
  onClose,
  onSave,
  goal,
  availableParentGoals = [],
  defaultPeriod = "monthly",
}: GoalInputProps) {
  const [text, setText] = useState("");
  const [description, setDescription] = useState("");
  const [period, setPeriod] = useState<
    "yearly" | "quarterly" | "monthly" | "daily"
  >(defaultPeriod);
  const [targetDate, setTargetDate] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [specificPeriod, setSpecificPeriod] = useState<string | null>(null);

  // Initialize form with goal data if editing
  useEffect(() => {
    if (goal) {
      setText(goal.text);
      setDescription(goal.description || "");
      setPeriod(goal.period);
      setTargetDate(
        goal.targetDate ? format(goal.targetDate, "yyyy-MM-dd") : ""
      );
      setParentId(goal.parentId);
      setIsRecurring(goal.isRecurring);
      setSpecificPeriod(goal.specificPeriod);
    } else {
      // Reset for new goal
      setText("");
      setDescription("");
      setPeriod(defaultPeriod);
      setTargetDate(format(new Date(), "yyyy-MM-dd"));
      setParentId(null);
      setIsRecurring(false);

      // Auto-set specific period based on current date and period
      const now = new Date();
      if (defaultPeriod === "quarterly") {
        const quarter = Math.ceil((now.getMonth() + 1) / 3);
        setSpecificPeriod(`${now.getFullYear()}-Q${quarter}`);
      } else if (defaultPeriod === "monthly") {
        const month = (now.getMonth() + 1).toString().padStart(2, "0");
        setSpecificPeriod(`${now.getFullYear()}-${month}`);
      } else if (defaultPeriod === "daily") {
        setSpecificPeriod(format(now, "yyyy-MM-dd"));
      } else {
        setSpecificPeriod(null);
      }
    }
  }, [goal, defaultPeriod, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    // Only require targetDate for yearly goals
    if (period === "yearly" && !targetDate) return;

    // For non-yearly goals, generate placeholder date from period
    let finalTargetDate: Date | undefined;
    if (period === "yearly") {
      finalTargetDate = new Date(targetDate);
    } else if (specificPeriod) {
      // Parse from specific period (e.g., "2026-Q1" or "2026-01" or "2025-12-24")
      if (period === "quarterly") {
        const [year, quarter] = specificPeriod.split("-Q");
        finalTargetDate = new Date(
          parseInt(year),
          parseInt(quarter) * 3 - 1,
          1
        );
      } else if (period === "monthly") {
        // Monthly: "2026-01" format
        finalTargetDate = new Date(specificPeriod + "-01");
      } else if (period === "daily") {
        // Daily: "2025-12-24" format (already a full date)
        finalTargetDate = new Date(specificPeriod);
      }
    } else {
      // Recurring: use end of current year as placeholder
      finalTargetDate = new Date(new Date().getFullYear(), 11, 31);
    }

    onSave({
      text: text.trim(),
      description: description.trim() || undefined,
      period,
      targetDate: finalTargetDate,
      parentId,
      isRecurring,
      specificPeriod:
        period === "yearly" || isRecurring ? null : specificPeriod,
    });

    onClose();
  };

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Filter parent goals based on selected period
  const filteredParentGoals = availableParentGoals.filter((g) => {
    if (period === "monthly")
      return g.period === "quarterly" || g.period === "yearly";
    if (period === "quarterly") return g.period === "yearly";
    return false;
  });

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white rounded-lg w-full max-w-md mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {goal ? "Edit Goal" : "New Goal"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Goal Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Goal Title *
            </label>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="e.g., Launch new product"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
              placeholder="Optional details about this goal..."
              rows={3}
            />
          </div>

          {/* Period */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Time Horizon *
            </label>
            <select
              value={period}
              onChange={(e) => {
                const newPeriod = e.target.value as
                  | "yearly"
                  | "quarterly"
                  | "monthly"
                  | "daily";
                setPeriod(newPeriod);
                // Reset recurring and specific period when changing time horizon
                if (newPeriod === "yearly") {
                  setIsRecurring(false);
                  setSpecificPeriod(null);
                } else if (newPeriod === "quarterly") {
                  const now = new Date();
                  const quarter = Math.ceil((now.getMonth() + 1) / 3);
                  setSpecificPeriod(`${now.getFullYear()}-Q${quarter}`);
                } else if (newPeriod === "monthly") {
                  const now = new Date();
                  const month = (now.getMonth() + 1)
                    .toString()
                    .padStart(2, "0");
                  setSpecificPeriod(`${now.getFullYear()}-${month}`);
                } else if (newPeriod === "daily") {
                  const now = new Date();
                  setSpecificPeriod(format(now, "yyyy-MM-dd"));
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              required
            >
              <option value="yearly">Yearly</option>
              <option value="quarterly">Quarterly</option>
              <option value="monthly">Monthly</option>
              <option value="daily">Daily</option>
            </select>
          </div>

          {/* Recurring vs Specific (for quarterly, monthly, and daily) */}
          {(period === "quarterly" ||
            period === "monthly" ||
            period === "daily") && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Goal Type *
              </label>
              <div className="flex gap-4">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    checked={!isRecurring}
                    onChange={() => setIsRecurring(false)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">
                    Specific {period === "quarterly" ? "Quarter" : "Month"}
                  </span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    checked={isRecurring}
                    onChange={() => setIsRecurring(true)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Recurring</span>
                </label>
              </div>
            </div>
          )}

          {/* Specific Period Selector (for quarterly and monthly non-recurring) */}
          {!isRecurring && period === "quarterly" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Which Quarter? *
              </label>
              <select
                value={specificPeriod || ""}
                onChange={(e) => setSpecificPeriod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                required
              >
                {/* Generate next 8 quarters */}
                {Array.from({ length: 8 }, (_, i) => {
                  const now = new Date();
                  const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);
                  const currentYear = now.getFullYear();
                  const totalQuarters =
                    (currentYear - 2025) * 4 + currentQuarter + i;
                  const year = 2025 + Math.floor((totalQuarters - 1) / 4);
                  const quarter = ((totalQuarters - 1) % 4) + 1;
                  const value = `${year}-Q${quarter}`;
                  return (
                    <option key={value} value={value}>
                      Q{quarter} {year}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {!isRecurring && period === "monthly" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Which Month? *
              </label>
              <input
                type="month"
                value={specificPeriod || ""}
                onChange={(e) => setSpecificPeriod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                required
              />
            </div>
          )}

          {!isRecurring && period === "daily" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Which Date? *
              </label>
              <input
                type="date"
                value={specificPeriod || ""}
                onChange={(e) => setSpecificPeriod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                required
              />
            </div>
          )}

          {/* Target Date - Only for yearly goals */}
          {period === "yearly" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target Date *
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                required
              />
            </div>
          )}

          {/* Parent Goal (if applicable) */}
          {filteredParentGoals.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Link to Parent Goal (Optional)
              </label>
              <select
                value={parentId || ""}
                onChange={(e) => setParentId(e.target.value || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="">None</option>
                {filteredParentGoals.map((parentGoal) => (
                  <option key={parentGoal.id} value={parentGoal.id}>
                    {parentGoal.text} ({parentGoal.period})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {goal ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
