"use client";

import { DragDropTodoList } from "@/components/DragDropTodoList";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8">
        <DragDropTodoList />
      </div>
    </div>
  );
}
