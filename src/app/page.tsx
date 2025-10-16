"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Background from "@/components/background";
import Button from "@/components/button";

export default function Home() {
  const router = useRouter();
  const [startUrl, setStartUrl] = useState("https://www.metmuseum.org");
  const [initialPrompt, setInitialPrompt] = useState(
    "Go to the Metropolitan Museum of Art website and find a single public domain photos for ukiyo-e (japanese woodblock prints)"
  );
  const [isStarting, setIsStarting] = useState(false);

  const handleStartSession = async () => {
    if (!startUrl || !initialPrompt) {
      alert("Please enter both start URL and initial prompt");
      return;
    }

    setIsStarting(true);

    try {
      const response = await fetch("/api/agent/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startUrl,
          initialPrompt,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to start session");
      }

      const data = await response.json();
      // Redirect to session page
      router.push(`/session/${data.sessionId}`);
    } catch (error) {
      console.error("Error starting session:", error);
      alert("Failed to start session");
      setIsStarting(false);
    }
  };

  return (
    <div className="min-h-[calc(100dvh)] bg-gray-50 flex items-center justify-center p-4">
      <Background />

      <div className="w-full max-w-xl z-20 space-y-12">
        <h1 className="text-2xl font-bold text-white text-center">What should Browsafex do?</h1>

        <div className="space-y-2">
          <div>
            <textarea
              value={initialPrompt}
              onChange={(e) => setInitialPrompt(e.target.value)}
              className="w-full p-4 rounded-3xl focus:ring-2 focus:ring-cyan-400 focus:outline-none bg-white/80 backdrop-blur-lg"
              rows={4}
              placeholder="Find the best restaurant in..."
            />
          </div>

          <div className="px-8">
            <div className="relative">
              <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-sm text-gray-600 pointer-events-none text-black z-20">
                Start at
              </span>
              <input
                type="text"
                value={startUrl}
                onChange={(e) => setStartUrl(e.target.value)}
                className="text-sm w-full py-2 pl-18 pr-4 rounded-xl focus:ring-2 focus:ring-cyan-400 focus:outline-none bg-white/80 backdrop-blur-lg"
                placeholder="https://google.com"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <Button onClick={handleStartSession} disabled={isStarting} size="large">
            {isStarting ? "Starting..." : "Start"}
          </Button>
        </div>
      </div>
    </div>
  );
}
