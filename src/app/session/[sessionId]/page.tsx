"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Background from "@/components/background";
import Link from "next/link";
import Button from "@/components/button";
import SendIcon from "@/components/icons/SendIcon";
import Loader from "@/components/icons/Loader";

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
    <div className="min-h-screen bg-gray-50 flex flex-col p-4">
      <Background />

      {/* Top Bar */}
      <div className="z-20">
        <div className="max-w-[2000px] mx-auto flex items-center justify-between">
          <Link href="/" className="text-lg font-medium text-white hover:text-cyan-300 transition-colors">
            Browsafex
          </Link>
          <div className="text-lg font-medium text-white">
            {state === "running" ? (
              <Loader className="size-12 pl-2" />
            ) : state === "completed" ? (
              "✅ Completed"
            ) : state === "error" ? (
              "❌ Error"
            ) : (
              ""
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={handleStartNewSession} size="small" style="outline" color="neutral">
              New Session
            </Button>
            <Button onClick={handleFinishTask} size="small" style="outline" color="neutral">
              Finish Task
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden z-20">
        <div className="max-w-[2000px] mx-auto p-6 h-full space-y-4">
          {/* Main Content: Browser View + Activity */}
          <div className="flex flex-col xl:flex-row gap-4 h-[calc(100vh-180px)]">
            {/* Browser View */}
            <div className="flex-1 rounded-lg overflow-hidden">
              <div className="w-full h-full flex items-start justify-center">
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
            <div className="max-w-2xl rounded-lg shadow flex flex-col space-y-2">
              {/* Activity Messages */}
              <div className="flex-1 overflow-y-auto space-y-3">
                {activity.length === 0 ? (
                  <div className="text-gray-400 text-sm">No activity yet...</div>
                ) : (
                  <>
                    {activity.map((item, index) => (
                      <div key={index}>
                        {item.type === "user" ? (
                          <div className="flex justify-end">
                            <div className="bg-cyan-500/70 backdrop-blur-lg text-white rounded-lg px-4 py-2 max-w-[85%]">
                              <div className="text-sm leading-relaxed">{item.content}</div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-start">
                            <div className="bg-white/80 backdrop-blur-lg rounded-lg p-3 max-w-[85%]">
                              <div className="text-sm text-gray-900 mb-2 leading-relaxed">{item.thoughts}</div>
                              {item.commands && item.commands.length > 0 && (
                                <div className="space-y-1">
                                  {item.commands.map((command, cmdIndex) => (
                                    <div
                                      key={cmdIndex}
                                      className="text-xs font-mono bg-white/90 text-gray-800 px-2 py-1 rounded border border-gray-200"
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
              <div>
                <div className="flex gap-2 items-center relative">
                  <textarea
                    value={currentPrompt}
                    onChange={(e) => setCurrentPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    className="flex-1 pl-3 pr-10 py-2 text-sm rounded-xl focus:ring-2 focus:ring-cyan-400 focus:outline-none bg-transparenttext-white backdrop-blur-lg border border-gray-700 placeholder-gray-500"
                    rows={2}
                    placeholder={
                      state === "completed" ? "Enter follow-up instructions..." : "Agent is still working..."
                    }
                    disabled={state !== "completed"}
                  />

                  <button
                    onClick={handleSendMessage}
                    disabled={!currentPrompt || state !== "completed"}
                    className="cursor-pointer bg-linear-to-br from-cyan-400 to-sky-500 text-white hover:from-cyan-500 hover:to-sky-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl p-2 absolute right-2 top-1/2 -translate-y-1/2"
                  >
                    <SendIcon className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <button onClick={() => setShowDebugLogs(!showDebugLogs)} className="text-sm text-gray-500 cursor-pointer">
              {showDebugLogs ? "Hide" : "Show"} Debug
            </button>
          </div>

          {/* Debug Logs (Collapsible) */}
          {showDebugLogs && (
            <div className="bg-white/80 backdrop-blur-lg rounded-lg shadow p-4 mb-4">
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
        </div>
      </div>
    </div>
  );
}
