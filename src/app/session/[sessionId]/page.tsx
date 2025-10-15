"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";

interface LogEntry {
  timestamp: number;
  level: "info" | "success" | "error" | "warn" | "log";
  content: string;
}

interface ActivityItem {
  type: "user" | "agent";
  timestamp: number;
  content?: string; // for user messages
  thoughts?: string; // for agent
  commands?: string[]; // for agent
}

export default function SessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [currentPrompt, setCurrentPrompt] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [currentScreenshot, setCurrentScreenshot] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "initializing" | "running" | "completed" | "error" | "terminated">(
    "idle"
  );
  const [showDebugLogs, setShowDebugLogs] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const activityEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Auto-scroll logs to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Auto-scroll activity to bottom
  useEffect(() => {
    activityEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activity]);

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
            setActivity((prev) => [
              ...prev,
              {
                type: "agent",
                timestamp: data.data.timestamp,
                thoughts: data.data.thoughts,
                commands: data.data.commands,
              },
            ]);
          } else if (data.type === "userMessage") {
            setActivity((prev) => [
              ...prev,
              {
                type: "user",
                timestamp: data.data.timestamp,
                content: data.data.content,
              },
            ]);
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

  const handleSendMessage = async () => {
    if (!sessionId || !currentPrompt) {
      return;
    }

    const message = currentPrompt;
    setCurrentPrompt("");

    try {
      const response = await fetch("/api/agent/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          message,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }
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

    // Navigate to home
    router.push("/");
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-medium text-gray-900">Browser Agent</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowDebugLogs(!showDebugLogs)}
              className="px-3 py-1.5 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              {showDebugLogs ? "Hide" : "Show"} Debug
            </button>
            <button
              onClick={handleStartNewSession}
              className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              New Session
            </button>
            <button
              onClick={handleFinishTask}
              className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700"
            >
              Finish Task
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <div className="max-w-8xl mx-auto p-6 h-full">
          {/* Debug Logs (Collapsible) */}
          {showDebugLogs && (
            <div className="bg-white rounded-lg shadow p-4 mb-4">
              <h2 className="text-sm font-semibold mb-3 text-gray-900">Debug Logs</h2>
              <div className="border border-gray-300 rounded bg-gray-50 p-3 h-64 overflow-y-auto font-mono text-xs">
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

          {/* Main Content: Browser View + Activity */}
          <div className="flex flex-col xl:flex-row gap-4 h-[calc(100vh-180px)]">
            {/* Browser View */}
            <div className="flex-1 bg-white rounded-lg shadow p-4 overflow-hidden">
              <div className="w-full h-full flex items-center justify-center">
                {currentScreenshot ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`data:image/png;base64,${currentScreenshot}`}
                    alt="Browser screenshot"
                    className="max-w-full max-h-full object-contain bg-gray-100 rounded border border-gray-300"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-100 rounded border border-gray-300 flex items-center justify-center text-gray-400">
                    No screenshot yet
                  </div>
                )}
              </div>
            </div>

            {/* Agent Activity - Chat Style */}
            <div className="xl:w-96 bg-white rounded-lg shadow flex flex-col">
              {/* Status Header */}
              <div className="border-b border-gray-200 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Status:</span>
                  <span
                    className={`text-xs font-semibold ${
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
              </div>

              {/* Activity Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {activity.length === 0 ? (
                  <div className="text-gray-400 text-sm">No activity yet...</div>
                ) : (
                  <>
                    {activity.map((item, index) => (
                      <div key={index}>
                        {item.type === "user" ? (
                          <div className="flex justify-end">
                            <div className="bg-blue-600 text-white rounded-lg px-4 py-2 max-w-[85%]">
                              <div className="text-sm leading-relaxed">{item.content}</div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-start">
                            <div className="bg-gray-100 rounded-lg p-3 max-w-[85%]">
                              <div className="text-sm text-gray-900 mb-2 leading-relaxed">{item.thoughts}</div>
                              {item.commands && item.commands.length > 0 && (
                                <div className="space-y-1">
                                  {item.commands.map((command, cmdIndex) => (
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
                          </div>
                        )}
                      </div>
                    ))}
                    <div ref={activityEndRef} />
                  </>
                )}
              </div>

              {/* Message Input */}
              <div className="border-t border-gray-200 p-4">
                <div className="flex gap-2 items-stretch">
                  <textarea
                    value={currentPrompt}
                    onChange={(e) => setCurrentPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={2}
                    placeholder={
                      state === "completed" ? "Enter follow-up instructions..." : "Agent is still working..."
                    }
                    disabled={state !== "completed"}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!currentPrompt || state !== "completed"}
                    className="px-4 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
