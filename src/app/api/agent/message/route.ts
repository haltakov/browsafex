import { NextRequest, NextResponse } from "next/server";
import { sessionManager } from "@/lib/session-manager";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, message } = body;

    if (!sessionId || !message) {
      return NextResponse.json({ error: "sessionId and message are required" }, { status: 400 });
    }

    const session = sessionManager.getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (!session.worker) {
      return NextResponse.json({ error: "Worker not available" }, { status: 400 });
    }

    // Send message to worker
    session.worker.postMessage({
      type: "continue",
      data: { message },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
