"use client";

import { useState } from "react";
import { DragDropTodoList } from "@/components/DragDropTodoList";
import { MobileTodoList } from "@/components/MobileTodoList";
import { GoalsDashboard } from "@/components/GoalsDashboard";
import { MobileGoals } from "@/components/MobileGoals";
import { AuthPage } from "@/components/AuthPage";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut } from "lucide-react";

type View = "todos" | "goals";

export default function Home() {
  const { user, loading, signOut } = useAuth();
  const [activeView, setActiveView] = useState<View>("todos");

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <>
      {/* Sign out button - fixed position */}
      <button
        onClick={handleSignOut}
        className="fixed top-4 right-4 z-50 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors shadow-sm flex items-center gap-2"
        title="Sign out"
      >
        <LogOut className="w-4 h-4" />
        <span className="hidden sm:inline">Sign Out</span>
      </button>

      {/* Desktop view - shown on screens >= 640px */}
      <div className="hidden sm:block min-h-screen bg-gray-50 py-4">
        <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8">
          {activeView === "todos" ? (
            <DragDropTodoList onViewChange={setActiveView} />
          ) : (
            <GoalsDashboard onViewChange={setActiveView} />
          )}
        </div>
      </div>

      {/* Mobile view - shown on screens < 640px */}
      <div className="block sm:hidden">
        {activeView === "todos" ? <MobileTodoList /> : <MobileGoals />}
      </div>
    </>
  );
}
