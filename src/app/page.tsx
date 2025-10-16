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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 z-10 min-h-screen bg-[#222]">
        <picture className="w-full h-full object-cover opacity-30">
          <source
            type="image/avif"
            media="(max-aspect-ratio: 9/16)"
            srcSet="
          browsafex_background-ver-360.avif 360w,
          browsafex_background-ver-480.avif 480w,
          browsafex_background-ver-720.avif 720w,
          browsafex_background-ver-1080.avif 1080w"
            sizes="(max-aspect-ratio: 9/16) 100vw, 50vw"
          />

          <source
            type="image/jpeg"
            media="(max-aspect-ratio: 9/16)"
            srcSet="
          browsafex_background-ver-360.jpg 360w,
          browsafex_background-ver-480.jpg 480w,
          browsafex_background-ver-720.jpg 720w,
          browsafex_background-ver-1080.jpg 1080w"
            sizes="(max-aspect-ratio: 9/16) 100vw, 50vw"
          />

          <source
            type="image/avif"
            srcSet="
          browsafex_background-hor-640.avif 640w,
          browsafex_background-hor-960.avif 960w,
          browsafex_background-hor-1280.avif 1280w,
          browsafex_background-hor-1920.avif 1920w,
          browsafex_background-hor-2880.avif 2880w"
            sizes="100vw"
          />

          <source
            type="image/jpeg"
            srcSet="
          browsafex_background-hor-640.jpg 640w,
          browsafex_background-hor-960.jpg 960w,
          browsafex_background-hor-1280.jpg 1280w,
          browsafex_background-hor-1920.jpg 1920w,
          browsafex_background-hor-2880.jpg 2880w"
            sizes="100vw"
          />

          <img
            className="w-full h-full object-cover"
            src="browsafex_background-hor-2880.jpg"
            alt="Browsafex background"
          />
        </picture>
      </div>

      <div className="w-full max-w-xl z-20 space-y-12">
        <h1 className="text-3xl font-bold text-white text-center">What should Browsafex do?</h1>

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
          <button
            onClick={handleStartSession}
            disabled={isStarting}
            className="px-32 py-2 bg-linear-to-br text-xl from-cyan-300 to-sky-400 text-white font-bold rounded-3xl hover:from-cyan-400 hover:to-sky-500 disabled:from-gray-400 disabled:to-gray-500 cursor-pointer"
          >
            {isStarting ? "Starting..." : "Start"}
          </button>
        </div>
      </div>
    </div>
  );
}
