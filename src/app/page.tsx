"use client";

import { useState, useEffect, useRef } from "react";

interface LogEntry {
  timestamp: number;
  level: "info" | "success" | "error" | "warn" | "log";
  content: string;
}

export default function Home() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startUrl, setStartUrl] = useState("https://www.metmuseum.org");
  const [initialPrompt, setInitialPrompt] = useState(
    "Go to the Metropolitan Museum of Art website and find a single public domain photos for ukiyo-e (japanese woodblock prints)"
  );
  const [currentPrompt, setCurrentPrompt] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentScreenshot, setCurrentScreenshot] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "initializing" | "running" | "completed" | "error" | "terminated">(
    "idle"
  );
  const [isStarting, setIsStarting] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Auto-scroll logs to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Setup SSE connection when session is created
  useEffect(() => {
    if (sessionId) {
      const eventSource = new EventSource(`/api/agent/events?sessionId=${sessionId}`);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "log") {
            setLogs((prev) => [...prev, data.data]);
          } else if (data.type === "screenshot") {
            setCurrentScreenshot(data.data);
          } else if (data.type === "state") {
            setState(data.data);
          }
        } catch (error) {
          console.error("Error parsing SSE data:", error);
        }
      };

      eventSource.onerror = (error) => {
        console.error("SSE error:", error);
        eventSource.close();
      };

      return () => {
        eventSource.close();
      };
    }
  }, [sessionId]);

  const handleStartSession = async () => {
    if (!startUrl || !initialPrompt) {
      alert("Please enter both start URL and initial prompt");
      return;
    }

    setIsStarting(true);
    setLogs([]);
    setCurrentScreenshot(null);

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
      setSessionId(data.sessionId);
      setState("initializing");
    } catch (error) {
      console.error("Error starting session:", error);
      alert("Failed to start session");
      setState("error");
    } finally {
      setIsStarting(false);
    }
  };

  const handleSendMessage = async () => {
    if (!sessionId || !currentPrompt) {
      return;
    }

    try {
      const response = await fetch("/api/agent/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          message: currentPrompt,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      setCurrentPrompt("");
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message");
    }
  };

  const handleFinishTask = async () => {
    if (!sessionId) {
      return;
    }

    if (!confirm("Are you sure you want to finish this task and close the browser?")) {
      return;
    }

    try {
      const response = await fetch("/api/agent/finish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to finish session");
      }

      // Close SSE connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      setState("terminated");
    } catch (error) {
      console.error("Error finishing session:", error);
      alert("Failed to finish session");
    }
  };

  const handleStartNewSession = () => {
    // Close current SSE connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Reset state
    setSessionId(null);
    setLogs([]);
    setCurrentScreenshot(null);
    setState("idle");
    setInitialPrompt("");
    setCurrentPrompt("");
  };

  const getLogColor = (level: LogEntry["level"]) => {
    switch (level) {
      case "error":
        return "text-red-600";
      case "warn":
        return "text-yellow-600";
      case "success":
        return "text-green-600";
      case "info":
        return "text-blue-600";
      default:
        return "text-gray-700";
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-gray-900">Browser Agent</h1>

        {/* Start URL and Initial Prompt */}
        {!sessionId && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Start URL</label>
              <input
                type="text"
                value={startUrl}
                onChange={(e) => setStartUrl(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="https://www.example.com"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Initial Prompt</label>
              <textarea
                value={initialPrompt}
                onChange={(e) => setInitialPrompt(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="What should the agent do?"
              />
            </div>
            <button
              onClick={handleStartSession}
              disabled={isStarting}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isStarting ? "Starting..." : "Start Session"}
            </button>
          </div>
        )}

        {/* Session Active */}
        {sessionId && (
          <>
            {/* Status Bar */}
            <div className="bg-white rounded-lg shadow p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-gray-700">Status: </span>
                  <span
                    className={`text-sm font-semibold ${
                      state === "running"
                        ? "text-blue-600"
                        : state === "completed"
                        ? "text-green-600"
                        : state === "error"
                        ? "text-red-600"
                        : "text-gray-600"
                    }`}
                  >
                    {state.toUpperCase()}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleStartNewSession}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                  >
                    Start New Session
                  </button>
                  <button
                    onClick={handleFinishTask}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                  >
                    Finish Task
                  </button>
                </div>
              </div>
            </div>

            {/* Screenshot */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4 text-gray-900">Browser View</h2>
              <div className="w-full" style={{ aspectRatio: "1440/900" }}>
                {currentScreenshot ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`data:image/png;base64,${currentScreenshot}`}
                    alt="Browser screenshot"
                    className="w-full h-full object-contain bg-gray-100 rounded border border-gray-300"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-100 rounded border border-gray-300 flex items-center justify-center text-gray-400">
                    No screenshot yet
                  </div>
                )}
              </div>
            </div>

            {/* Agent Logs */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4 text-gray-900">Agent Logs</h2>
              <div className="border border-gray-300 rounded-md bg-gray-50 p-4 h-96 overflow-y-auto font-mono text-sm">
                {logs.length === 0 ? (
                  <div className="text-gray-400">No logs yet...</div>
                ) : (
                  <>
                    {logs.map((log, index) => (
                      <div key={index} className="mb-1">
                        <span className="text-gray-500 text-xs">[{formatTimestamp(log.timestamp)}]</span>{" "}
                        <span className={getLogColor(log.level)}>{log.content}</span>
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </>
                )}
              </div>
            </div>

            {/* Prompt Input */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4 text-gray-900">Send Message</h2>
              <div className="flex gap-2">
                <textarea
                  value={currentPrompt}
                  onChange={(e) => setCurrentPrompt(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={2}
                  placeholder={state === "completed" ? "Enter follow-up instructions..." : "Agent is still working..."}
                  disabled={state !== "completed"}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!currentPrompt || state !== "completed"}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  Send
                </button>
              </div>
              {state !== "completed" && (
                <p className="mt-2 text-sm text-gray-500">
                  You can send messages when the agent completes its current task
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
