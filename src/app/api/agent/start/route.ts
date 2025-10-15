import { NextRequest, NextResponse } from "next/server";
import { Worker } from "worker_threads";
import { sessionManager } from "@/lib/session-manager";
import * as path from "path";
import { fileURLToPath } from "url";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { startUrl, initialPrompt } = body;

    if (!startUrl || !initialPrompt) {
      return NextResponse.json({ error: "startUrl and initialPrompt are required" }, { status: 400 });
    }

    // Create a new session
    const session = sessionManager.createSession(startUrl);

    // Create worker thread
    const workerPath = path.join(process.cwd(), "src/lib/agent/worker.ts");
    const tsxLoader = path.join(process.cwd(), "node_modules/tsx/dist/cjs/index.cjs");

    const worker = new Worker(workerPath, {
      execArgv: ["--require", tsxLoader],
    });

    // Update session with worker
    sessionManager.updateSession(session.id, { worker });

    // Handle messages from worker
    worker.on("message", (message) => {
      if (message.type === "log") {
        sessionManager.addLog(session.id, message.data);
      } else if (message.type === "screenshot") {
        sessionManager.addScreenshot(session.id, message.data);
      } else if (message.type === "state") {
        sessionManager.updateState(session.id, message.data);
      }
    });

    worker.on("error", (error) => {
      console.error("Worker error:", error);
      sessionManager.updateState(session.id, "error");
      sessionManager.addLog(session.id, {
        timestamp: Date.now(),
        level: "error",
        content: `Worker error: ${error.message}`,
      });
    });

    worker.on("exit", (code) => {
      const currentSession = sessionManager.getSession(session.id);
      if (currentSession && code !== 0 && currentSession.state !== "terminated") {
        sessionManager.updateState(session.id, "error");
      }
    });

    // Start the agent
    worker.postMessage({
      type: "start",
      data: {
        startUrl,
        instructions: initialPrompt,
      },
    });

    return NextResponse.json({ sessionId: session.id });
  } catch (error) {
    console.error("Error starting agent:", error);
    return NextResponse.json({ error: "Failed to start agent" }, { status: 500 });
  }
}
