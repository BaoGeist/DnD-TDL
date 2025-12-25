"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/utils/supabaseClient";

export default function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      // Get the code from URL parameters
      const code = searchParams.get("code");

      if (code) {
        // Exchange the code for a session
        const { data, error } = await supabase.auth.exchangeCodeForSession(
          code
        );

        if (error) {
          console.error("Error exchanging code for session:", error);
          router.push("/?error=auth_failed");
          return;
        }

        if (data.session) {
          // Successfully authenticated, redirect to home
          router.push("/");
          return;
        }
      }

      // Fallback: try to get existing session
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) {
        console.error("Error during OAuth callback:", sessionError);
        router.push("/?error=auth_failed");
        return;
      }

      if (sessionData.session) {
        router.push("/");
      } else {
        // No session found
        console.error("No session or code found");
        router.push("/?error=no_session");
      }
    };

    handleCallback();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Completing sign in...</p>
      </div>
    </div>
  );
}
