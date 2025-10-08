"use client";

import { DragDropTodoList } from "@/components/DragDropTodoList";
import { MobileTodoList } from "@/components/MobileTodoList";
import { PasswordProtection } from "@/components/PasswordProtection";

export default function Home() {
  return (
    <PasswordProtection>
      {/* Desktop view - shown on screens >= 640px */}
      <div className="hidden sm:block min-h-screen bg-gray-50 py-8">
        <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8">
          <DragDropTodoList />
        </div>
      </div>

      {/* Mobile view - shown on screens < 640px */}
      <div className="block sm:hidden">
        <MobileTodoList />
      </div>
    </PasswordProtection>
  );
}
