"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold mb-8 text-gray-900 text-center">Browser Agent</h1>

        {/* Start URL and Initial Prompt */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="mb-4">
            <label className="block text-xs font-normal text-gray-500 mb-2">Start URL</label>
            <input
              type="text"
              value={startUrl}
              onChange={(e) => setStartUrl(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="https://www.example.com"
            />
          </div>
          <div className="mb-6">
            <label className="block text-xs font-normal text-gray-500 mb-2">Initial Prompt</label>
            <textarea
              value={initialPrompt}
              onChange={(e) => setInitialPrompt(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={4}
              placeholder="What should the agent do?"
            />
          </div>
          <div className="flex justify-center">
            <button
              onClick={handleStartSession}
              disabled={isStarting}
              className="px-8 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isStarting ? "Starting..." : "Start Session"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
