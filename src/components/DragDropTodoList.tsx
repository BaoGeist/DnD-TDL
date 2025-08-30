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
import { format, startOfWeek, addDays } from "date-fns";
import { CanvasTodoItem } from "./CanvasTodoItem";
import { WeekDayArea } from "./WeekDayArea";
import { supabase } from "../utils/supabaseClient";

export interface Todo {
  id: string;
  text: string;
  estimatedHours: number;
  completed: boolean;
  position: { x: number; y: number };
  dayOfWeek: string | null;
  isEditing?: boolean;
  isInDatabase?: boolean; // Track if this todo exists in database
}

export function DragDropTodoList() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

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
        .order("created_at", { ascending: true });
      if (!error && data) {
        // Transform database format to Todo interface format
        const transformedTodos = data.map((todo: Record<string, unknown>) => ({
          id: todo.id as string,
          text: (todo.text as string) || "",
          estimatedHours:
            ((todo.estimatedHours || todo.estimated_hours) as number) || 1,
          completed: (todo.completed as boolean) || false,
          position: {
            x: (todo.position_x as number) || 0,
            y: (todo.position_y as number) || 0,
          },
          dayOfWeek: (todo.dayOfWeek as string) || null,
          isInDatabase: true, // Mark as already in database
        }));

        // Clear existing todos and set only database todos to prevent duplicates
        setTodos(transformedTodos);

        // Snap todos to their assigned sections after loading, in case screen size changed
        setTimeout(snapTodosToSections, 200);
      }
    }
    fetchTodos();
  }, []);

  // Function to snap todos to their assigned day areas
  const snapTodosToSections = () => {
    if (!canvasRef.current) return;

    setTodos((currentTodos) => {
      return currentTodos.map((todo, index) => {
        // Only reposition items that are assigned to a day
        if (!todo.dayOfWeek) return todo;

        const dayAreaId =
          todo.dayOfWeek === "backlog"
            ? "backlog-day"
            : `${todo.dayOfWeek}-day`;
        const dayAreaElement = document.querySelector(
          `[data-day-area="${dayAreaId}"]`
        );

        if (!dayAreaElement) return todo;

        const dayRect = dayAreaElement.getBoundingClientRect();
        const canvasRect = canvasRef.current!.getBoundingClientRect();

        // Count how many items are already in this day area (before this one)
        const itemsInSameDay = currentTodos
          .slice(0, index)
          .filter((t) => t.dayOfWeek === todo.dayOfWeek).length;

        // Calculate new position: left-justified within the day area with some padding
        const newX = dayRect.left - canvasRect.left + 10; // 10px padding from left
        const newY = dayRect.top - canvasRect.top + 80 + itemsInSameDay * 35; // Stack vertically, increased from 60 to 80

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

  // Get current week days
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    return {
      name: format(date, "EEEE"),
      date: format(date, "MMM d"),
      fullDate: date,
    };
  });

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
      // Transform Todo format to database format
      const dbTodo = {
        id: todo.id, // Keep as string UUID
        text: todo.text,
        estimatedHours: todo.estimatedHours,
        completed: todo.completed,
        position_x: todo.position.x,
        position_y: todo.position.y,
        dayOfWeek: todo.dayOfWeek,
      };

      // Use upsert to prevent duplicates (insert or update if exists)
      const { error } = await supabase
        .from("todos")
        .upsert([dbTodo], { onConflict: "id" });

      if (error) {
        console.error("Failed to save todo to database:", error);
      }
    } catch (err) {
      console.error("Database connection error:", err);
    }
  };

  // Update todo in Supabase
  const updateTodo = async (id: string, updates: Partial<Todo>) => {
    try {
      // Transform updates to database format
      const dbUpdates: Record<string, unknown> = {};

      if (updates.text !== undefined) dbUpdates.text = updates.text;
      if (updates.estimatedHours !== undefined)
        dbUpdates.estimatedHours = updates.estimatedHours;
      if (updates.completed !== undefined)
        dbUpdates.completed = updates.completed;
      if (updates.dayOfWeek !== undefined)
        dbUpdates.dayOfWeek = updates.dayOfWeek;
      if (updates.position !== undefined) {
        dbUpdates.position_x = updates.position.x;
        dbUpdates.position_y = updates.position.y;
      }

      const { error } = await supabase
        .from("todos")
        .update(dbUpdates)
        .eq("id", id);

      if (error) {
        console.error("Failed to update todo in database:", error);
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
          }

          return updatedTodo;
        }
        return todo;
      });
    });
  };

  // Delete todo from Supabase
  const deleteTodo = async (id: string) => {
    // Remove from local state immediately
    setTodos((prev) => prev.filter((todo) => todo.id !== id));

    try {
      const { error } = await supabase.from("todos").delete().eq("id", id);
      if (error) {
        console.error("Failed to delete todo from database:", error);
        // Could re-add the todo back to local state here if needed
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
    const newTodo: Todo = {
      id: crypto.randomUUID(),
      text: "",
      estimatedHours: 1,
      completed: false,
      position: { x, y },
      dayOfWeek: null,
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
      const newDayOfWeek = detectDayFromPosition(newX, newY);

      const updatedTodo = {
        ...todoToUpdate,
        position: { x: newX, y: newY },
        dayOfWeek: newDayOfWeek,
      };

      // Update local state
      setTodos((prev) =>
        prev.map((todo) => (todo.id === active.id ? updatedTodo : todo))
      );

      // Update in Supabase
      await updateTodo(updatedTodo.id, {
        position: updatedTodo.position,
        dayOfWeek: updatedTodo.dayOfWeek,
      });
    }

    setActiveId(null);
  };

  // Helper function to detect which day area a position overlaps with
  const detectDayFromPosition = (x: number, y: number): string | null => {
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
        if (dayId === "unassigned-day") {
          return null; // Explicitly return null for unassigned area
        } else if (dayId === "backlog-day") {
          return "backlog";
        } else if (dayId === "incomplete-day") {
          return null; // Incomplete area maps to null dayOfWeek
        }
        return dayId ? dayId.replace("-day", "") : null;
      }
    }

    return null;
  };

  const activeTodo = todos.find((todo) => todo.id === activeId);

  return (
    <div className="h-screen bg-gray-50 overflow-hidden">
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Week Day Grid */}
        <div className="h-full">
          <div className="grid grid-cols-4 gap-4 mb-4 h-[calc(37.5%-2rem)]">
            <WeekDayArea
              key="incomplete"
              id="incomplete-day"
              name="Incomplete"
              date="Carry Over"
              todos={todos.filter((todo) => !todo.dayOfWeek)}
            />
            {weekDays.slice(0, 3).map((day) => (
              <WeekDayArea
                key={day.name}
                id={`${day.name}-day`}
                name={day.name}
                date={day.date}
                todos={todos.filter((todo) => todo.dayOfWeek === day.name)}
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
                todos={todos.filter((todo) => todo.dayOfWeek === day.name)}
              />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 h-[calc(25%-2rem)]">
            <WeekDayArea
              key="backlog"
              id="backlog-day"
              name="Backlog"
              date="Ideas & Future Projects"
              todos={todos.filter((todo) => todo.dayOfWeek === "backlog")}
            />
          </div>
        </div>

        {/* Canvas for all todos */}
        <div
          ref={canvasRef}
          className="absolute top-0 left-0 right-0 bottom-0 cursor-crosshair pointer-events-auto"
          onDoubleClick={handleDoubleClick}
        >
          {/* All Todo Items */}
          {todos.map((todo) => (
            <CanvasTodoItem
              key={todo.id}
              todo={todo}
              onUpdate={handleTodoUpdate}
              onDelete={deleteTodo}
              isDragging={activeId === todo.id}
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
    </div>
  );
}
