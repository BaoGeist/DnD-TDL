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

export interface Todo {
  id: string;
  text: string;
  estimatedHours: number;
  completed: boolean;
  position: { x: number; y: number };
  dayOfWeek: string | null;
  isEditing?: boolean;
}

export function DragDropTodoList() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [todos, setTodos] = useState<Todo[]>([
    {
      id: "1",
      text: "Review project proposal",
      estimatedHours: 2,
      completed: false,
      position: { x: 100, y: 100 },
      dayOfWeek: null,
    },
    {
      id: "2",
      text: "Call dentist",
      estimatedHours: 0.5,
      completed: false,
      position: { x: 300, y: 150 },
      dayOfWeek: null,
    },
  ]);

  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

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
        const newY = dayRect.top - canvasRect.top + 60 + itemsInSameDay * 35; // Stack vertically

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

  const handleDoubleClick = (event: React.MouseEvent) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Don't create todos if clicking on existing elements
    if ((event.target as HTMLElement).closest("[data-todo-item]")) return;

    const newTodo: Todo = {
      id: Date.now().toString(),
      text: "",
      estimatedHours: 1,
      completed: false,
      position: { x, y },
      dayOfWeek: null,
      isEditing: true,
    };

    setTodos((todos) => [...todos, newTodo]);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    // Don't modify body overflow to prevent page shifting
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;

    // Update position based on final delta and detect day overlap
    if (delta && canvasRef.current) {
      const canvasRect = canvasRef.current.getBoundingClientRect();

      const updatedTodos = todos.map((todo) => {
        if (todo.id === active.id) {
          const newX = Math.max(
            0,
            Math.min(canvasRect.width - 80, todo.position.x + delta.x)
          );
          const newY = Math.max(
            0,
            Math.min(canvasRect.height - 30, todo.position.y + delta.y)
          );

          // Detect which day area this position overlaps with
          const newDayOfWeek = detectDayFromPosition(newX, newY);

          return {
            ...todo,
            position: { x: newX, y: newY },
            dayOfWeek: newDayOfWeek,
          };
        }
        return todo;
      });

      setTodos(updatedTodos);
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

  const updateTodo = (id: string, updates: Partial<Todo>) => {
    setTodos((todos) =>
      todos.map((todo) => (todo.id === id ? { ...todo, ...updates } : todo))
    );
  };

  const deleteTodo = (id: string) => {
    setTodos((todos) => todos.filter((todo) => todo.id !== id));
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
              onUpdate={updateTodo}
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
