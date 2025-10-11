"use client";

import { useState, useEffect } from "react";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { ChevronLeft, ChevronRight, Dice3 } from "lucide-react";
import { MobileTaskItem } from "./MobileTaskItem";
import { TaskModal } from "./TaskModal";
import { Todo } from "./DragDropTodoList";
import { supabase } from "../utils/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";

export function MobileTodoList() {
  const { user } = useAuth();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return startOfWeek(today, { weekStartsOn: 0 }); // Start on Sunday
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [animatingTaskId, setAnimatingTaskId] = useState<string | null>(null);

  // Fetch todos from database
  useEffect(() => {
    async function fetchTodos() {
      if (!user) return;

      const { data, error } = await supabase
        .from("todos")
        .select("*")
        .eq("user_id", user.id)
        .neq("status", "deleted")
        .order("created_at", { ascending: true });

      if (!error && data) {
        const transformedTodos = data.map((todo: Record<string, unknown>) => {
          const dayOfWeek = (todo.dayOfWeek as string) || null;
          let scheduledDate: Date | null = null;

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
            dayOfWeek,
            isInDatabase: true,
          };
        });

        setTodos(transformedTodos);
      }
    }
    fetchTodos();
  }, [user]);

  // Get current week days starting from Sunday
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

  // Helper functions to categorize tasks
  const getBacklogTasks = (): Todo[] => {
    return todos.filter((todo) => todo.dayOfWeek === "backlog");
  };

  const getTasksForDay = (targetDate: Date): Todo[] => {
    return todos.filter(
      (todo) => todo.scheduledDate && isSameDay(todo.scheduledDate, targetDate)
    );
  };

  const getIncompleteTasks = (): Todo[] => {
    return todos.filter((todo) => {
      return !todo.scheduledDate && todo.dayOfWeek !== "backlog";
    });
  };

  const getTotalHoursForDay = (tasks: Todo[]): number => {
    return tasks
      .filter((todo) => todo.status !== 'completed')
      .reduce((sum, todo) => sum + todo.estimatedHours, 0);
  };

  // Week navigation
  const goToPreviousWeek = () => {
    setCurrentWeekStart((prev) => addDays(prev, -7));
  };

  const goToNextWeek = () => {
    setCurrentWeekStart((prev) => addDays(prev, 7));
  };

  // Random task picker
  const pickRandomTask = () => {
    const todayTasks = todos.filter(
      (todo) =>
        todo.scheduledDate &&
        isSameDay(todo.scheduledDate, today) &&
        todo.status !== 'completed'
    );

    if (todayTasks.length > 0) {
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

  // Task actions
  const handleTaskTap = (id: string) => {
    const todo = todos.find((t) => t.id === id);
    if (todo) {
      setEditingTodo(todo);
      setIsModalOpen(true);
    }
  };

  const handleToggleComplete = async (id: string) => {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;

    const newStatus = todo.status === 'completed' ? 'active' : 'completed';

    // Update local state
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t))
    );

    // Update database
    try {
      await supabase
        .from("todos")
        .update({ status: newStatus })
        .eq("id", id);
    } catch (err) {
      console.error("Failed to update todo:", err);
    }
  };

  const handleDeleteTodo = async (id: string) => {
    // Remove from local state
    setTodos((prev) => prev.filter((t) => t.id !== id));

    // Soft delete in database (set status to 'deleted')
    try {
      await supabase.from("todos").update({ status: 'deleted' }).eq("id", id);
    } catch (err) {
      console.error("Failed to delete todo:", err);
    }
  };

  const handleCreateTask = () => {
    setEditingTodo(null);
    setIsModalOpen(true);
  };

  const handleSaveTask = async (taskData: {
    text: string;
    estimatedHours: number;
    scheduledDate: Date | null;
    dayOfWeek: string | null;
  }) => {
    if (editingTodo) {
      // Update existing task
      const updatedTodo = {
        ...editingTodo,
        text: taskData.text,
        estimatedHours: taskData.estimatedHours,
        scheduledDate: taskData.scheduledDate,
        dayOfWeek: taskData.dayOfWeek,
      };

      setTodos((prev) =>
        prev.map((t) => (t.id === editingTodo.id ? updatedTodo : t))
      );

      // Update database
      try {
        await supabase
          .from("todos")
          .update({
            text: taskData.text,
            estimatedHours: taskData.estimatedHours,
            scheduleddate: taskData.scheduledDate?.toISOString() || null,
            dayOfWeek: taskData.dayOfWeek || null,
          })
          .eq("id", editingTodo.id);
      } catch (err) {
        console.error("Failed to update todo:", err);
      }
    } else {
      // Create new task
      const newTodo: Todo = {
        id: crypto.randomUUID(),
        text: taskData.text,
        estimatedHours: taskData.estimatedHours,
        status: 'active',
        position: { x: 0, y: 0 },
        scheduledDate: taskData.scheduledDate,
        dayOfWeek: taskData.dayOfWeek,
        isInDatabase: true,
      };

      setTodos((prev) => [...prev, newTodo]);

      // Save to database
      try {
        if (!user) return;

        await supabase.from("todos").insert([
          {
            id: newTodo.id,
            text: newTodo.text,
            estimatedHours: newTodo.estimatedHours,
            status: newTodo.status,
            position_x: newTodo.position.x,
            position_y: newTodo.position.y,
            scheduleddate: newTodo.scheduledDate?.toISOString() || null,
            dayOfWeek: newTodo.dayOfWeek || null,
            user_id: user.id,
          },
        ]);
      } catch (err) {
        console.error("Failed to create todo:", err);
      }
    }
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Sticky Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 shadow-sm">
        {/* Week Navigation */}
        <div className="px-4 py-3 flex items-center justify-between">
          <button
            onClick={goToPreviousWeek}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="text-center">
            <div className="text-sm font-semibold text-gray-900">
              {format(currentWeekStart, "MMM d")} -{" "}
              {format(addDays(currentWeekStart, 6), "MMM d, yyyy")}
            </div>
          </div>

          <button
            onClick={goToNextWeek}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="px-4 pb-3 flex gap-2">
          <button
            onClick={handleCreateTask}
            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            + Create Task
          </button>
          <button
            onClick={pickRandomTask}
            className="p-3 bg-gray-100 rounded-lg hover:bg-gray-200"
            title="Pick Random Task"
          >
            <Dice3 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {/* Backlog Section */}
        <div className="border-b-4 border-gray-300">
          <div className="bg-gray-100 px-4 py-3 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Backlog</h3>
              <p className="text-xs text-gray-500">Ideas & Future Projects</p>
            </div>
            <div className="text-sm text-gray-600">
              {getTotalHoursForDay(getBacklogTasks())}h
            </div>
          </div>
          <div>
            {getBacklogTasks().length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400 text-sm">
                No tasks in backlog
              </div>
            ) : (
              getBacklogTasks().map((todo) => (
                <div
                  key={todo.id}
                  className={animatingTaskId === todo.id ? "animate-bounce" : ""}
                >
                  <MobileTaskItem
                    todo={todo}
                    onTap={handleTaskTap}
                    onToggleComplete={handleToggleComplete}
                    onDelete={handleDeleteTodo}
                  />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Week Days */}
        {weekDays.map((day) => {
          const dayTasks = getTasksForDay(day.fullDate);
          return (
            <div key={day.name} className="border-b border-gray-200">
              <div
                className={`px-4 py-3 flex items-center justify-between ${
                  day.isToday ? "bg-blue-50" : "bg-gray-50"
                }`}
              >
                <div>
                  <h3
                    className={`font-semibold ${
                      day.isToday ? "text-blue-700" : "text-gray-900"
                    }`}
                  >
                    {day.name}
                  </h3>
                  <p className="text-xs text-gray-500">{day.date}</p>
                </div>
                <div className="text-sm text-gray-600">
                  {getTotalHoursForDay(dayTasks)}h
                </div>
              </div>
              <div>
                {dayTasks.length === 0 ? (
                  <div className="px-4 py-8 text-center text-gray-400 text-sm">
                    No tasks scheduled
                  </div>
                ) : (
                  dayTasks.map((todo) => (
                    <div
                      key={todo.id}
                      className={
                        animatingTaskId === todo.id ? "animate-bounce" : ""
                      }
                    >
                      <MobileTaskItem
                        todo={todo}
                        onTap={handleTaskTap}
                        onToggleComplete={handleToggleComplete}
                        onDelete={handleDeleteTodo}
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}

        {/* Incomplete Section */}
        <div className="border-b-4 border-gray-300">
          <div className="bg-gray-100 px-4 py-3 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Incomplete</h3>
              <p className="text-xs text-gray-500">Carry Over</p>
            </div>
            <div className="text-sm text-gray-600">
              {getTotalHoursForDay(getIncompleteTasks())}h
            </div>
          </div>
          <div>
            {getIncompleteTasks().length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400 text-sm">
                No incomplete tasks
              </div>
            ) : (
              getIncompleteTasks().map((todo) => (
                <div
                  key={todo.id}
                  className={animatingTaskId === todo.id ? "animate-bounce" : ""}
                >
                  <MobileTaskItem
                    todo={todo}
                    onTap={handleTaskTap}
                    onToggleComplete={handleToggleComplete}
                    onDelete={handleDeleteTodo}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Task Modal */}
      <TaskModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTodo(null);
        }}
        onSave={handleSaveTask}
        todo={editingTodo}
        currentWeekStart={currentWeekStart}
      />
    </div>
  );
}
