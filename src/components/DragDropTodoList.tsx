"use client";

import { useState, useRef, useEffect } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  AlignJustify,
  Calendar,
  Dice3,
  History,
} from "lucide-react";
import { CanvasTodoItem } from "./CanvasTodoItem";
import { WeekDayArea } from "./WeekDayArea";
import { HistoryModal } from "./HistoryModal";
import { supabase } from "../utils/supabaseClient";
import {
  logTodoCreated,
  logTodoUpdated,
  logTodoDeleted,
} from "../utils/historyLogger";

export interface Todo {
  id: string;
  text: string;
  estimatedHours: number;
  status: 'active' | 'completed' | 'deleted';
  position: { x: number; y: number };
  scheduledDate: Date | null; // Replaced dayOfWeek with specific date
  dayOfWeek?: string | null; // Keep for backward compatibility during migration
  isEditing?: boolean;
  isInDatabase?: boolean; // Track if this todo exists in database
}

export function DragDropTodoList() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [animatingTaskId, setAnimatingTaskId] = useState<string | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return startOfWeek(today, { weekStartsOn: 1 });
  });
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    async function fetchTodos() {
      const { data, error } = await supabase
        .from("todos")
        .select("*")
        .neq("status", "deleted") // Exclude deleted todos
        .order("created_at", { ascending: true });
      if (!error && data) {
        // Transform database format to Todo interface format
        const transformedTodos = data.map((todo: Record<string, unknown>) => {
          const dayOfWeek = (todo.dayOfWeek as string) || null;
          let scheduledDate: Date | null = null;

          // Get scheduledDate from database (after migration) - using lowercase column name
          if (todo.scheduleddate) {
            scheduledDate = new Date(todo.scheduleddate as string);
          }

          return {
            id: todo.id as string,
            text: (todo.text as string) || "",
            estimatedHours:
              ((todo.estimatedHours || todo.estimated_hours) as number) || 1,
            status: (todo.status as 'active' | 'completed' | 'deleted') || 'active',
            position: {
              x: (todo.position_x as number) || 0,
              y: (todo.position_y as number) || 0,
            },
            scheduledDate,
            dayOfWeek, // Keep for backward compatibility
            isInDatabase: true, // Mark as already in database
          };
        });

        // Clear existing todos and set only database todos to prevent duplicates
        setTodos(transformedTodos);

        // Snap todos to their assigned sections after loading, in case screen size changed
        setTimeout(snapTodosToSections, 200);
      }
    }
    fetchTodos();
  }, [currentWeekStart]);

  // Function to snap todos to their assigned day areas
  const snapTodosToSections = () => {
    if (!canvasRef.current) return;

    setTodos((currentTodos) => {
      return currentTodos.map((todo, index) => {
        // Only reposition items that are assigned to a day or backlog
        if (!todo.scheduledDate && todo.dayOfWeek !== "backlog") return todo;

        let dayAreaId: string;
        if (todo.dayOfWeek === "backlog") {
          dayAreaId = "backlog-day";
        } else if (todo.scheduledDate) {
          // Find the day name for the scheduled date
          const dayName = format(todo.scheduledDate, "EEEE");
          dayAreaId = `${dayName}-day`;
        } else {
          return todo; // No valid assignment
        }

        const dayAreaElement = document.querySelector(
          `[data-day-area="${dayAreaId}"]`
        );

        if (!dayAreaElement) return todo;

        const dayRect = dayAreaElement.getBoundingClientRect();
        const canvasRect = canvasRef.current!.getBoundingClientRect();

        // Count how many items are already in this day area (before this one)
        const itemsInSameDay = currentTodos.slice(0, index).filter((t) => {
          if (todo.dayOfWeek === "backlog") {
            return t.dayOfWeek === "backlog";
          } else if (todo.scheduledDate) {
            return (
              t.scheduledDate && isSameDay(t.scheduledDate, todo.scheduledDate)
            );
          }
          return false;
        }).length;

        // Multi-column layout calculations
        const taskHeight = 35; // Vertical spacing between tasks
        const headerHeight = 90; // Space reserved for day header (increased from 80)
        const bottomPadding = 5; // Space at bottom of container (reduced from 20)
        const columnWidth = 170; // Width for each column (accommodates max task width + padding)
        const columnSpacing = 20; // Space between columns
        const leftPadding = 10; // Initial left padding

        // Calculate available height for tasks
        const availableHeight = dayRect.height - headerHeight - bottomPadding;
        const tasksPerColumn = Math.max(
          1,
          Math.floor(availableHeight / taskHeight)
        ); // Ensure at least 1 task per column

        // Calculate max columns that fit in container width
        const availableWidth = dayRect.width - leftPadding * 2;
        const maxColumns = Math.floor(
          availableWidth / (columnWidth + columnSpacing)
        );

        // Determine which column this task belongs to
        let columnIndex = Math.floor(itemsInSameDay / tasksPerColumn);
        let taskIndexInColumn = itemsInSameDay % tasksPerColumn;

        // Fallback handling for extreme cases (too many columns)
        if (columnIndex >= maxColumns) {
          // If we exceed max columns, compress into available columns and reduce task height
          const totalTasks = currentTodos.filter((t) => {
            if (todo.dayOfWeek === "backlog") {
              return t.dayOfWeek === "backlog";
            } else if (todo.scheduledDate) {
              return (
                t.scheduledDate &&
                isSameDay(t.scheduledDate, todo.scheduledDate)
              );
            }
            return false;
          }).length;
          const adjustedTasksPerColumn = Math.ceil(totalTasks / maxColumns);
          const adjustedTaskHeight = Math.min(
            taskHeight,
            availableHeight / adjustedTasksPerColumn
          );

          columnIndex = Math.floor(itemsInSameDay / adjustedTasksPerColumn);
          taskIndexInColumn = itemsInSameDay % adjustedTasksPerColumn;

          // Recalculate position with adjusted values
          const newX =
            dayRect.left -
            canvasRect.left +
            leftPadding +
            columnIndex * (columnWidth + columnSpacing);
          const newY =
            dayRect.top -
            canvasRect.top +
            headerHeight +
            taskIndexInColumn * adjustedTaskHeight;

          return {
            ...todo,
            position: { x: newX, y: newY },
          };
        }

        // Calculate position for normal case
        const newX =
          dayRect.left -
          canvasRect.left +
          leftPadding +
          columnIndex * (columnWidth + columnSpacing);
        const newY =
          dayRect.top -
          canvasRect.top +
          headerHeight +
          taskIndexInColumn * taskHeight;

        return {
          ...todo,
          position: { x: newX, y: newY },
        };
      });
    });
  };

  // Add resize listener to snap items when window resizes
  useEffect(() => {
    const handleResize = () => {
      // Use a timeout to ensure the layout has updated
      setTimeout(snapTodosToSections, 100);
    };

    window.addEventListener("resize", handleResize);

    // Also snap on initial load
    setTimeout(snapTodosToSections, 100);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Track mouse position for cursor-based task creation
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        setMousePosition({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        });
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Helper function to check if any todo is currently being edited
      const isAnyTodoBeingEdited = (): boolean => {
        return todos.some(todo => todo.isEditing) ||
               document.querySelector('input[type="text"]:focus, input[type="number"]:focus') !== null;
      };

      // Ignore keyboard shortcuts if any todo is being edited
      if (isAnyTodoBeingEdited() || activeId !== null) {
        return;
      }

      // Ignore if user is typing in any input field
      const activeElement = document.activeElement;
      if (activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.getAttribute('contenteditable') === 'true'
      )) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case 'd':
          event.preventDefault();
          goToPreviousWeek();
          break;
        case 'f':
          event.preventDefault();
          goToNextWeek();
          break;
        case 'a':
          event.preventDefault();
          alignAllTasks();
          break;
        case 'r':
          event.preventDefault();
          pickRandomTask();
          break;
        case 't':
          event.preventDefault();
          if (event.shiftKey || event.ctrlKey) {
            // Shift+T or Ctrl+T: Go to current week
            goToCurrentWeek();
          } else {
            // T alone: Create task at cursor
            createTaskAtCursor();
          }
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [todos, activeId, mousePosition]);

  // Create task at cursor position
  const createTaskAtCursor = () => {
    if (!canvasRef.current) return;

    // Use current mouse position, or fallback to center of screen
    let x = mousePosition.x;
    let y = mousePosition.y;

    // If mouse position is invalid or outside canvas, use center
    const canvasRect = canvasRef.current.getBoundingClientRect();
    if (x < 0 || y < 0 || x > canvasRect.width || y > canvasRect.height) {
      x = canvasRect.width / 2;
      y = canvasRect.height / 2;
    }

    // Detect which day area the position is in
    const detectedDate = detectDateFromPosition(x, y);
    let scheduledDate: Date | null = null;
    let dayOfWeek: string | null = null;

    if (detectedDate === "backlog") {
      dayOfWeek = "backlog";
      scheduledDate = null;
    } else if (detectedDate) {
      scheduledDate = detectedDate;
      dayOfWeek = format(detectedDate, "EEEE");
    }

    const newTodo: Todo = {
      id: crypto.randomUUID(),
      text: "",
      estimatedHours: 1,
      status: 'active',
      position: { x, y },
      scheduledDate,
      dayOfWeek,
      isEditing: true,
      isInDatabase: false,
    };
    addTodo(newTodo);
  };

  // Get week days for current viewed week
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(currentWeekStart, i);
    const isToday = isSameDay(date, today);
    return {
      name: format(date, "EEEE"),
      date: format(date, "MMM d"),
      fullDate: date,
      isToday,
    };
  });

  // Helper functions for task categorization
  const isDateInCurrentWeek = (date: Date): boolean => {
    const weekEnd = addDays(currentWeekStart, 6);
    return date >= currentWeekStart && date <= weekEnd;
  };

  const getTasksForDay = (targetDate: Date): Todo[] => {
    return todos.filter(
      (todo) => todo.scheduledDate && isSameDay(todo.scheduledDate, targetDate)
    );
  };

  const getIncompleteTasks = (): Todo[] => {
    return todos.filter((todo) => {
      // Only truly unscheduled tasks (no scheduled date and not in backlog)
      return !todo.scheduledDate && todo.dayOfWeek !== "backlog";
    });
  };

  const getBacklogTasks = (): Todo[] => {
    return todos.filter((todo) => todo.dayOfWeek === "backlog");
  };

  // Week navigation functions
  const goToPreviousWeek = () => {
    setCurrentWeekStart((prev) => addDays(prev, -7));
  };

  const goToNextWeek = () => {
    setCurrentWeekStart((prev) => addDays(prev, 7));
  };

  const goToCurrentWeek = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    setCurrentWeekStart(startOfWeek(today, { weekStartsOn: 1 }));
  };

  const alignAllTasks = () => {
    snapTodosToSections();
  };

  const pickRandomTask = () => {
    // Get all tasks scheduled for today that are not completed
    // Use local midnight to avoid timezone issues
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayTasks = todos.filter(
      (todo) =>
        todo.scheduledDate &&
        isSameDay(todo.scheduledDate, today) &&
        todo.status !== 'completed'
    );

    if (todayTasks.length === 0) {
      // If no tasks for today, get tasks from current viewed week
      const currentWeekTasks = todos.filter(
        (todo) =>
          todo.scheduledDate &&
          isDateInCurrentWeek(todo.scheduledDate) &&
          todo.status !== 'completed'
      );

      if (currentWeekTasks.length === 0) return; // No tasks to pick

      const randomTask =
        currentWeekTasks[Math.floor(Math.random() * currentWeekTasks.length)];
      animateTask(randomTask.id);
    } else {
      const randomTask =
        todayTasks[Math.floor(Math.random() * todayTasks.length)];
      animateTask(randomTask.id);
    }
  };

  const animateTask = (taskId: string) => {
    setAnimatingTaskId(taskId);
    setTimeout(() => {
      setAnimatingTaskId(null);
    }, 1000);
  };

  // Add todo to local state only (not database yet)
  const addTodo = (todo: Todo) => {
    // Check if todo with this ID already exists to prevent duplicates
    setTodos((prev) => {
      const existingTodo = prev.find((t) => t.id === todo.id);
      if (existingTodo) {
        return prev; // Don't add duplicate
      }
      return [...prev, todo];
    });
  };

  // Save todo to database (called when todo is complete with title and hours)
  const saveTodoToDatabase = async (todo: Todo) => {
    try {
      console.log("Saving todo to database:", todo);

      // Transform Todo format to database format
      const dbTodo: Record<string, unknown> = {
        id: todo.id,
        text: todo.text,
        estimatedHours: todo.estimatedHours,
        status: todo.status,
        position_x: todo.position.x,
        position_y: todo.position.y,
        dayOfWeek: todo.dayOfWeek || null,
        scheduleddate: todo.scheduledDate?.toISOString() || null,
      };

      console.log("Database todo object:", dbTodo);

      // Use upsert to prevent duplicates (insert or update if exists)
      const { data, error } = await supabase
        .from("todos")
        .upsert([dbTodo], { onConflict: "id" });

      if (error) {
        console.error("Failed to save todo to database:", error);
        console.error("Error details:", JSON.stringify(error, null, 2));
      } else {
        console.log("Successfully saved todo:", data);
        // Log creation event
        await logTodoCreated(todo);
      }
    } catch (err) {
      console.error("Database connection error:", err);
    }
  };

  // Update todo in Supabase
  const updateTodo = async (id: string, updates: Partial<Todo>) => {
    try {
      console.log("Updating todo:", id, updates);

      // Transform updates to database format
      const dbUpdates: Record<string, unknown> = {};

      if (updates.text !== undefined) dbUpdates.text = updates.text;
      if (updates.estimatedHours !== undefined)
        dbUpdates.estimatedHours = updates.estimatedHours;
      if (updates.status !== undefined)
        dbUpdates.status = updates.status;
      if (updates.dayOfWeek !== undefined)
        dbUpdates.dayOfWeek = updates.dayOfWeek || null;
      if (updates.position !== undefined) {
        dbUpdates.position_x = updates.position.x;
        dbUpdates.position_y = updates.position.y;
      }
      if (updates.scheduledDate !== undefined) {
        dbUpdates.scheduleddate = updates.scheduledDate?.toISOString() || null;
      }

      console.log("Database updates:", dbUpdates);

      const { data, error } = await supabase
        .from("todos")
        .update(dbUpdates)
        .eq("id", id);

      if (error) {
        console.error("Failed to update todo in database:", error);
        console.error("Error details:", JSON.stringify(error, null, 2));
      } else {
        console.log("Successfully updated todo:", data);
      }
    } catch (err) {
      console.error("Database connection error:", err);
    }
  };

  // Wrapper function for synchronous updates from CanvasTodoItem
  const handleTodoUpdate = (id: string, updates: Partial<Todo>) => {
    // Update local state immediately for UI responsiveness
    setTodos((prev) => {
      return prev.map((todo) => {
        if (todo.id === id) {
          const oldTodo = { ...todo };
          const updatedTodo = { ...todo, ...updates };

          // Check if this is a new todo that should be saved to database
          if (
            !todo.isInDatabase &&
            updatedTodo.text.trim() &&
            updatedTodo.estimatedHours > 0
          ) {
            // Save to database and mark as saved
            saveTodoToDatabase({ ...updatedTodo, isInDatabase: true });
            return { ...updatedTodo, isInDatabase: true };
          } else if (todo.isInDatabase) {
            // Update existing todo in database
            updateTodo(id, updates);
            // Log history for significant changes
            logTodoUpdated(id, oldTodo, updatedTodo);
          }

          return updatedTodo;
        }
        return todo;
      });
    });
  };

  // Delete todo (soft delete - set status to 'deleted')
  const deleteTodo = async (id: string) => {
    // Get the todo before removing it for history logging
    const todoToDelete = todos.find((t) => t.id === id);

    // Remove from local state immediately
    setTodos((prev) => prev.filter((todo) => todo.id !== id));

    try {
      // Soft delete: update status to 'deleted' instead of actually deleting
      const { error } = await supabase
        .from("todos")
        .update({ status: 'deleted' })
        .eq("id", id);
      if (error) {
        console.error("Failed to delete todo from database:", error);
        // Could re-add the todo back to local state here if needed
      } else if (todoToDelete) {
        // Log deletion event
        await logTodoDeleted(todoToDelete);
      }
    } catch (err) {
      console.error("Database connection error:", err);
    }
  };

  // Example: handleDoubleClick now uses addTodo
  const handleDoubleClick = (event: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if ((event.target as HTMLElement).closest("[data-todo-item]")) return;

    // Detect which day area the click occurred in
    const detectedDate = detectDateFromPosition(x, y);
    let scheduledDate: Date | null = null;
    let dayOfWeek: string | null = null;

    if (detectedDate === "backlog") {
      dayOfWeek = "backlog";
      scheduledDate = null;
    } else if (detectedDate) {
      scheduledDate = detectedDate;
      dayOfWeek = format(detectedDate, "EEEE");
    }

    const newTodo: Todo = {
      id: crypto.randomUUID(),
      text: "",
      estimatedHours: 1,
      status: 'active',
      position: { x, y },
      scheduledDate,
      dayOfWeek, // Keep for backward compatibility
      isEditing: true,
      isInDatabase: false, // Mark as not in database yet
    };
    addTodo(newTodo);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    // Don't modify body overflow to prevent page shifting
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, delta } = event;

    if (delta && canvasRef.current) {
      const canvasRect = canvasRef.current.getBoundingClientRect();

      const todoToUpdate = todos.find((todo) => todo.id === active.id);
      if (!todoToUpdate) return;

      const newX = Math.max(
        0,
        Math.min(canvasRect.width - 80, todoToUpdate.position.x + delta.x)
      );
      const newY = Math.max(
        0,
        Math.min(canvasRect.height - 30, todoToUpdate.position.y + delta.y)
      );
      const detectedDate = detectDateFromPosition(newX, newY);

      const updatedTodo = {
        ...todoToUpdate,
        position: { x: newX, y: newY },
        scheduledDate: detectedDate === "backlog" ? null : detectedDate,
        dayOfWeek:
          detectedDate === "backlog"
            ? "backlog"
            : detectedDate
            ? format(detectedDate, "EEEE")
            : null,
      };

      // Update local state
      setTodos((prev) =>
        prev.map((todo) => (todo.id === active.id ? updatedTodo : todo))
      );

      // Update in Supabase
      await updateTodo(updatedTodo.id, {
        position: updatedTodo.position,
        scheduledDate: updatedTodo.scheduledDate,
        dayOfWeek: updatedTodo.dayOfWeek,
      });
    }

    setActiveId(null);
  };

  // Helper function to detect which date a position overlaps with
  const detectDateFromPosition = (
    x: number,
    y: number
  ): Date | "backlog" | null => {
    if (!canvasRef.current) return null;

    // Get all day area elements
    const dayAreas = document.querySelectorAll("[data-day-area]");

    for (const dayArea of dayAreas) {
      const rect = dayArea.getBoundingClientRect();
      const canvasRect = canvasRef.current.getBoundingClientRect();

      // Convert absolute position to relative position within canvas
      const relativeX = x + canvasRect.left;
      const relativeY = y + canvasRect.top;

      // Check if the todo position overlaps with this day area
      if (
        relativeX >= rect.left &&
        relativeX <= rect.right &&
        relativeY >= rect.top &&
        relativeY <= rect.bottom
      ) {
        const dayId = dayArea.getAttribute("data-day-area");
        if (dayId === "incomplete-day") {
          return null; // Incomplete area maps to null scheduledDate
        } else if (dayId === "backlog-day") {
          return "backlog";
        } else if (dayId) {
          // Find the corresponding day from weekDays
          const dayName = dayId.replace("-day", "");
          const matchingDay = weekDays.find((day) => day.name === dayName);
          return matchingDay ? matchingDay.fullDate : null;
        }
      }
    }

    return null;
  };

  const activeTodo = todos.find((todo) => todo.id === activeId);

  return (
    <div
      className="h-screen bg-gray-50 overflow-hidden flex flex-col"
      style={{ msOverflowStyle: "none", scrollbarWidth: "none" }}
    >
      {/* Week Navigation Header */}
      <div className="bg-gray-50 py-2 flex justify-center pointer-events-none mb-4">
        <div className="bg-white border-2 border-gray-200 rounded-lg px-4 py-2 pointer-events-auto">
          <div className="flex items-center space-x-3">
            <button
              onClick={goToPreviousWeek}
              className="p-1 hover:bg-gray-100 rounded-md transition-colors z-50 relative"
              title="Previous Week"
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
            >
              <ChevronLeft className="w-4 h-4 pointer-events-none" />
            </button>

            <div className="text-center pointer-events-none">
              <h2 className="text-sm font-semibold text-gray-900">
                {format(currentWeekStart, "MMM d")} -{" "}
                {format(addDays(currentWeekStart, 6), "MMM d, yyyy")}
              </h2>
            </div>

            <button
              onClick={goToNextWeek}
              className="p-1 hover:bg-gray-100 rounded-md transition-colors z-50 relative"
              title="Next Week"
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
            >
              <ChevronRight className="w-4 h-4 pointer-events-none" />
            </button>

            <div className="w-px h-4 bg-gray-300 mx-1"></div>

            <button
              onClick={alignAllTasks}
              className="p-1 hover:bg-gray-100 rounded-md transition-colors z-50 relative"
              title="Align All Tasks"
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
            >
              <AlignJustify className="w-4 h-4 pointer-events-none" />
            </button>

            <button
              onClick={goToCurrentWeek}
              className="p-1 hover:bg-gray-100 rounded-md transition-colors z-50 relative"
              title="Go to Current Week"
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
            >
              <Calendar className="w-4 h-4 pointer-events-none" />
            </button>

            <button
              onClick={pickRandomTask}
              className="p-1 hover:bg-gray-100 rounded-md transition-colors z-50 relative"
              title="Pick Random Task"
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
            >
              <Dice3 className="w-4 h-4 pointer-events-none" />
            </button>

            <div className="w-px h-4 bg-gray-300 mx-1"></div>

            <button
              onClick={() => setIsHistoryModalOpen(true)}
              className="p-1 hover:bg-gray-100 rounded-md transition-colors z-50 relative"
              title="View History"
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
            >
              <History className="w-4 h-4 pointer-events-none" />
            </button>
          </div>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Week Day Grid */}
        <div className="flex-1">
          <div className="grid grid-cols-4 gap-4 mb-4 h-[calc(37.5%-2rem)]">
            <WeekDayArea
              key="incomplete"
              id="incomplete-day"
              name="Incomplete"
              date="Carry Over"
              todos={getIncompleteTasks()}
            />
            {weekDays.slice(0, 3).map((day) => (
              <WeekDayArea
                key={day.name}
                id={`${day.name}-day`}
                name={day.name}
                date={day.date}
                todos={getTasksForDay(day.fullDate)}
                isToday={day.isToday}
              />
            ))}
          </div>

          <div className="grid grid-cols-4 gap-4 mb-4 h-[calc(37.5%-2rem)]">
            {weekDays.slice(3, 7).map((day) => (
              <WeekDayArea
                key={day.name}
                id={`${day.name}-day`}
                name={day.name}
                date={day.date}
                todos={getTasksForDay(day.fullDate)}
                isToday={day.isToday}
              />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 h-[calc(25%-2rem)]">
            <WeekDayArea
              key="backlog"
              id="backlog-day"
              name="Backlog"
              date="Ideas & Future Projects"
              todos={getBacklogTasks()}
            />
          </div>
        </div>

        {/* Canvas for all todos */}
        <div
          ref={canvasRef}
          className="absolute top-0 left-0 right-0 bottom-0 cursor-crosshair pointer-events-auto"
          onDoubleClick={handleDoubleClick}
        >
          {/* Only show todos for current week */}
          {todos
            .filter((todo) => {
              // Show backlog tasks (regardless of scheduledDate)
              if (todo.dayOfWeek === "backlog") return true;

              // Show truly unscheduled tasks (no scheduledDate and no dayOfWeek)
              if (!todo.scheduledDate && !todo.dayOfWeek) return true;

              // Show tasks scheduled for the current viewed week
              if (todo.scheduledDate && isDateInCurrentWeek(todo.scheduledDate))
                return true;

              // Hide everything else (tasks from other weeks)
              return false;
            })
            .map((todo) => (
              <CanvasTodoItem
                key={todo.id}
                todo={todo}
                onUpdate={handleTodoUpdate}
                onDelete={deleteTodo}
                isDragging={activeId === todo.id}
                isAnimating={animatingTaskId === todo.id}
              />
            ))}
        </div>

        <DragOverlay>
          {activeId && activeTodo ? (
            <CanvasTodoItem
              todo={activeTodo}
              onUpdate={() => {}}
              onDelete={() => {}}
              isDragging
              isOverlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* History Modal */}
      <HistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
      />
    </div>
  );
}
