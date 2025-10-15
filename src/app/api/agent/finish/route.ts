import { NextRequest, NextResponse } from "next/server";
import { sessionManager } from "@/lib/session-manager";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    const session = sessionManager.getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Send terminate message to worker
    if (session.worker) {
      session.worker.postMessage({
        type: "terminate",
      });
    }

    // Update state
    sessionManager.updateState(sessionId, "terminated");

    // Delete session after a short delay to allow cleanup
    setTimeout(() => {
      sessionManager.deleteSession(sessionId);
    }, 1000);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error finishing session:", error);
    return NextResponse.json({ error: "Failed to finish session" }, { status: 500 });
  }
}
