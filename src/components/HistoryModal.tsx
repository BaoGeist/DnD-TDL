"use client";

import { useState, useEffect } from "react";
import {
  format,
  eachDayOfInterval,
  subDays,
} from "date-fns";
import { X, Plus, Pencil, Check, Trash2 } from "lucide-react";
import { supabase } from "../utils/supabaseClient";

interface HistoryEvent {
  id: string;
  todo_id: string;
  event_type: "created" | "updated" | "completed" | "deleted";
  timestamp: string;
  changes: Record<string, { old: unknown; new: unknown }> | null;
  snapshot: {
    id: string;
    text: string;
    estimatedHours: number;
    status: string;
    dayOfWeek?: string | null;
    scheduleddate?: string | null;
  };
}

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type FilterType = "all" | "created" | "completed" | "deleted";
type ViewType = "chronological" | "by-task" | "timeline";

export function HistoryModal({ isOpen, onClose }: HistoryModalProps) {
  const [viewType, setViewType] = useState<ViewType>("timeline");
  const [filter, setFilter] = useState<FilterType>("all");
  const [historyEvents, setHistoryEvents] = useState<HistoryEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen]);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("todo_history")
        .select("*")
        .order("timestamp", { ascending: false });

      if (!error && data) {
        setHistoryEvents(data as HistoryEvent[]);
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Filter events based on selected filter (only for chronological view)
  const filteredEvents = historyEvents.filter((event) => {
    if (filter === "all") return true;
    return event.event_type === filter;
  });

  // Group events by task for "by-task" view (use all events, not filtered)
  const groupedByTask = historyEvents.reduce((acc, event) => {
    if (!acc[event.todo_id]) {
      acc[event.todo_id] = [];
    }
    acc[event.todo_id].push(event);
    return acc;
  }, {} as Record<string, HistoryEvent[]>);

  // Group events by date for timeline view
  const groupedByDate = filteredEvents.reduce((acc, event) => {
    const dateKey = format(new Date(event.timestamp), "yyyy-MM-dd");
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(event);
    return acc;
  }, {} as Record<string, HistoryEvent[]>);

  // Generate heatmap data (last 90 days)
  const generateHeatmapData = () => {
    const today = new Date();
    const startDate = subDays(today, 89); // Last 90 days
    const days = eachDayOfInterval({ start: startDate, end: today });

    return days.map((day) => {
      const dayKey = format(day, "yyyy-MM-dd");
      const eventsOnDay = historyEvents.filter((event) => {
        const eventDate = format(new Date(event.timestamp), "yyyy-MM-dd");
        return eventDate === dayKey;
      });

      const createdCount = eventsOnDay.filter(
        (e) => e.event_type === "created"
      ).length;
      const completedCount = eventsOnDay.filter(
        (e) => e.event_type === "completed"
      ).length;

      return {
        date: dayKey,
        count: eventsOnDay.length,
        createdCount,
        completedCount,
        day: format(day, "EEE"),
        dayOfMonth: format(day, "d"),
      };
    });
  };

  const heatmapData = generateHeatmapData();

  const renderEventIcon = (eventType: string) => {
    switch (eventType) {
      case "created":
        return <Plus className="w-3 h-3 text-blue-600" />;
      case "updated":
        return <Pencil className="w-3 h-3 text-yellow-600" />;
      case "completed":
        return <Check className="w-3 h-3 text-green-600" />;
      case "deleted":
        return <Trash2 className="w-3 h-3 text-red-600" />;
      default:
        return null;
    }
  };

  const renderChronologicalView = () => {
    if (filteredEvents.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500">
          No history events found
        </div>
      );
    }

    return (
      <div className="space-y-1">
        {filteredEvents.map((event) => (
          <div
            key={event.id}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded text-xs"
          >
            {renderEventIcon(event.event_type)}
            <span className="flex-1 truncate text-gray-900">
              {event.snapshot.text || "Untitled task"}
            </span>
            <span className="text-gray-400 flex-shrink-0">
              {format(new Date(event.timestamp), "MMM d, h:mm a")}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const renderByTaskView = () => {
    const taskIds = Object.keys(groupedByTask);

    if (taskIds.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500">
          No history events found
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {taskIds.map((todoId) => {
          const events = groupedByTask[todoId];
          const latestEvent = events[0];

          return (
            <div
              key={todoId}
              className="border border-gray-200 rounded-lg overflow-hidden"
            >
              <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
                <h4 className="font-medium text-xs text-gray-900 truncate">
                  {latestEvent.snapshot.text || "Untitled task"}
                </h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  {events.length} event{events.length !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="px-2 py-1 space-y-1">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded text-xs"
                  >
                    {renderEventIcon(event.event_type)}
                    <span className="flex-1 text-gray-700">
                      {event.event_type.charAt(0).toUpperCase() +
                        event.event_type.slice(1)}
                    </span>
                    <span className="text-gray-400 flex-shrink-0">
                      {format(new Date(event.timestamp), "MMM d, h:mm a")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderTimelineView = () => {
    const dates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

    if (dates.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500">
          No history events found
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {dates.map((dateKey) => {
          const events = groupedByDate[dateKey];
          const date = new Date(dateKey);

          return (
            <div key={dateKey} className="flex gap-4">
              {/* Date column */}
              <div className="flex-shrink-0 w-24 text-right">
                <div className="text-sm font-semibold text-gray-900">
                  {format(date, "MMM d")}
                </div>
                <div className="text-xs text-gray-500">
                  {format(date, "yyyy")}
                </div>
              </div>

              {/* Timeline line */}
              <div className="flex-shrink-0 flex flex-col items-center">
                <div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow"></div>
                <div className="w-0.5 bg-gray-200 flex-1"></div>
              </div>

              {/* Events column */}
              <div className="flex-1 pb-6">
                <div className="space-y-1">
                  {events.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded text-xs"
                    >
                      {renderEventIcon(event.event_type)}
                      <span className="flex-1 truncate text-gray-900">
                        {event.snapshot.text || "Untitled task"}
                      </span>
                      <span className="text-gray-400 flex-shrink-0">
                        {format(new Date(event.timestamp), "h:mm a")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const handleViewChange = (newView: ViewType) => {
    if (newView === viewType) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setViewType(newView);
    }, 30);
    setTimeout(() => {
      setIsTransitioning(false);
    }, 50);
  };

  const renderHeatmap = () => {
    if (historyEvents.length === 0) {
      return null;
    }

    // Group by weeks for display
    type HeatmapDay = {
      date: string;
      count: number;
      createdCount: number;
      completedCount: number;
      day: string;
      dayOfMonth: string;
    };
    const weeks: HeatmapDay[][] = [];
    let currentWeek: HeatmapDay[] = [];

    heatmapData.forEach((day, index) => {
      const date = new Date(day.date);
      const dayOfWeek = date.getDay();

      // Start a new week on Sunday
      if (dayOfWeek === 0 && currentWeek.length > 0) {
        weeks.push(currentWeek);
        currentWeek = [];
      }

      currentWeek.push(day);

      // Push the last week
      if (index === heatmapData.length - 1) {
        weeks.push(currentWeek);
      }
    });

    // Get max count for color scaling
    const maxCount = Math.max(...heatmapData.map((d) => d.count), 1);

    const getColor = (count: number) => {
      if (count === 0) return "bg-gray-100";
      const intensity = Math.min(count / maxCount, 1);
      if (intensity < 0.25) return "bg-blue-200";
      if (intensity < 0.5) return "bg-blue-400";
      if (intensity < 0.75) return "bg-blue-600";
      return "bg-blue-800";
    };

    return (
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center justify-center">
          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            className="text-xs text-gray-500 hover:text-gray-700 mb-2 transition-colors"
          >
            <span
              className="inline-block transition-transform duration-200"
              style={{
                transform: showHeatmap ? "rotate(90deg)" : "rotate(0deg)",
              }}
            >
              ▶
            </span>{" "}
            Activity Heatmap
          </button>
        </div>

        <div
          className="overflow-hidden transition-all duration-300 ease-in-out"
          style={{
            maxHeight: showHeatmap ? "200px" : "0px",
            opacity: showHeatmap ? 1 : 0,
          }}
        >
          <div className="flex justify-center pt-2">
            <div className="inline-flex flex-col gap-1">
              <div className="flex gap-1">
                {weeks.map((week, weekIndex) => (
                  <div key={weekIndex} className="flex flex-col gap-1">
                    {week.map((day) => (
                      <div
                        key={day.date}
                        className={`w-3 h-3 rounded-sm ${getColor(
                          day.count
                        )} cursor-pointer transition-all hover:ring-2 hover:ring-blue-500`}
                        title={`${format(
                          new Date(day.date),
                          "MMM d, yyyy"
                        )}\nCreated: ${day.createdCount}\nCompleted: ${
                          day.completedCount
                        }`}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50"
      onClick={handleBackdropClick}
    >
      {/* Bottom sheet */}
      <div
        className="bg-white rounded-t-2xl w-full max-w-4xl h-[85vh] flex flex-col animate-slide-up"
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
        <div className="flex-shrink-0 px-6 pt-2 pb-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Task History</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Heatmap (toggleable, above tabs) */}
          {renderHeatmap()}

          {/* View Tabs */}
          <div className="flex gap-2 my-4">
            <button
              onClick={() => handleViewChange("timeline")}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                viewType === "timeline"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Timeline
            </button>
            <button
              onClick={() => handleViewChange("by-task")}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                viewType === "by-task"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              By Task
            </button>
            <button
              onClick={() => handleViewChange("chronological")}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                viewType === "chronological"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              List
            </button>
          </div>

          {/* Filters (only show in chronological and timeline views) */}
          {(viewType === "chronological" || viewType === "timeline") && (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilter("all")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filter === "all"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter("created")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filter === "created"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Created
              </button>
              <button
                onClick={() => setFilter("completed")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filter === "completed"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Completed
              </button>
              <button
                onClick={() => setFilter("deleted")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filter === "deleted"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Deleted
              </button>
            </div>
          )}
        </div>

        {/* Scrollable Content with visible scrollbar */}
        <div
          className="flex-1 overflow-y-scroll px-6 py-4"
          style={{ scrollbarWidth: "thin" }}
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                <div className="text-sm text-gray-500">Loading history...</div>
              </div>
            </div>
          ) : (
            <div
              className={`transition-opacity duration-150 ${
                isTransitioning ? "opacity-0" : "opacity-100"
              }`}
            >
              {viewType === "timeline"
                ? renderTimelineView()
                : viewType === "by-task"
                ? renderByTaskView()
                : renderChronologicalView()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
