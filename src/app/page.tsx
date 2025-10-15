"use client";

import { useState, useEffect, useRef } from "react";

interface LogEntry {
  timestamp: number;
  level: "info" | "success" | "error" | "warn" | "log";
  content: string;
}

interface AgentIteration {
  timestamp: number;
  thoughts: string;
  commands: string[];
}

export default function Home() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startUrl, setStartUrl] = useState("https://www.metmuseum.org");
  const [initialPrompt, setInitialPrompt] = useState(
    "Go to the Metropolitan Museum of Art website and find a single public domain photos for ukiyo-e (japanese woodblock prints)"
  );
  const [currentPrompt, setCurrentPrompt] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [iterations, setIterations] = useState<AgentIteration[]>([]);
  const [currentScreenshot, setCurrentScreenshot] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "initializing" | "running" | "completed" | "error" | "terminated">(
    "idle"
  );
  const [isStarting, setIsStarting] = useState(false);
  const [showDebugLogs, setShowDebugLogs] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const iterationsEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Auto-scroll logs to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Auto-scroll iterations to bottom
  useEffect(() => {
    iterationsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [iterations]);

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
          } else if (data.type === "iteration") {
            setIterations((prev) => [...prev, data.data]);
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
    setIterations([]);
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
    setIterations([]);
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
              <div className="flex items-center justify-between flex-wrap gap-2">
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
                    onClick={() => setShowDebugLogs(!showDebugLogs)}
                    className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                  >
                    {showDebugLogs ? "Hide" : "Show"} Debug Logs
                  </button>
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

            {/* Main Content: Browser View + Iterations */}
            <div className="flex flex-col xl:flex-row gap-6 mb-6">
              {/* Browser View */}
              <div className="flex-1 bg-white rounded-lg shadow p-6">
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

              {/* Agent Iterations */}
              <div className="xl:w-96 bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4 text-gray-900">Agent Activity</h2>
                <div className="h-[600px] overflow-y-auto space-y-4">
                  {iterations.length === 0 ? (
                    <div className="text-gray-400 text-sm">No activity yet...</div>
                  ) : (
                    <>
                      {iterations.map((iteration, index) => (
                        <div
                          key={index}
                          className="border border-gray-200 rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                        >
                          <div className="text-xs text-gray-500 mb-2">{formatTimestamp(iteration.timestamp)}</div>
                          <div className="text-sm text-gray-900 mb-3 leading-relaxed">{iteration.thoughts}</div>
                          {iteration.commands.length > 0 && (
                            <div className="space-y-1">
                              {iteration.commands.map((command, cmdIndex) => (
                                <div
                                  key={cmdIndex}
                                  className="text-xs font-mono bg-blue-50 text-blue-800 px-2 py-1 rounded border border-blue-200"
                                >
                                  {command}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      <div ref={iterationsEndRef} />
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Debug Logs (Collapsible) */}
            {showDebugLogs && (
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-lg font-semibold mb-4 text-gray-900">Debug Logs</h2>
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
            )}

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
