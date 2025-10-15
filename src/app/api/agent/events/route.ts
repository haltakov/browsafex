import { NextRequest } from "next/server";
import { sessionManager, LogEntry, AgentIteration, UserMessage } from "@/lib/session-manager";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return new Response("sessionId is required", { status: 400 });
  }

  const session = sessionManager.getSession(sessionId);
  if (!session) {
    return new Response("Session not found", { status: 404 });
  }

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send existing logs
      for (const log of session.logs) {
        const data = JSON.stringify({ type: "log", data: log });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      }

      // Send existing screenshots
      for (const screenshot of session.screenshots) {
        const data = JSON.stringify({ type: "screenshot", data: screenshot });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      }

      // Send existing user messages and iterations in chronological order
      const activities = [
        ...session.userMessages.map((msg) => ({ type: "userMessage" as const, data: msg })),
        ...session.iterations.map((iter) => ({ type: "iteration" as const, data: iter })),
      ].sort((a, b) => a.data.timestamp - b.data.timestamp);

      for (const activity of activities) {
        const data = JSON.stringify(activity);
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      }

      // Send current state
      const stateData = JSON.stringify({ type: "state", data: session.state });
      controller.enqueue(encoder.encode(`data: ${stateData}\n\n`));

      // Listen for new events
      const onLog = (log: LogEntry) => {
        const data = JSON.stringify({ type: "log", data: log });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };

      const onScreenshot = (screenshot: string) => {
        const data = JSON.stringify({ type: "screenshot", data: screenshot });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };

      const onState = (state: string) => {
        const data = JSON.stringify({ type: "state", data: state });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };

      const onIteration = (iteration: AgentIteration) => {
        const data = JSON.stringify({ type: "iteration", data: iteration });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };

      const onUserMessage = (message: UserMessage) => {
        const data = JSON.stringify({ type: "userMessage", data: message });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };

      session.eventEmitter.on("log", onLog);
      session.eventEmitter.on("screenshot", onScreenshot);
      session.eventEmitter.on("state", onState);
      session.eventEmitter.on("iteration", onIteration);
      session.eventEmitter.on("userMessage", onUserMessage);

      // Cleanup on close
      request.signal.addEventListener("abort", () => {
        session.eventEmitter.off("log", onLog);
        session.eventEmitter.off("screenshot", onScreenshot);
        session.eventEmitter.off("state", onState);
        session.eventEmitter.off("iteration", onIteration);
        session.eventEmitter.off("userMessage", onUserMessage);
        controller.close();
      });

      // Send keep-alive every 30 seconds
      const keepAliveInterval = setInterval(() => {
        controller.enqueue(encoder.encode(": keep-alive\n\n"));
      }, 30000);

      request.signal.addEventListener("abort", () => {
        clearInterval(keepAliveInterval);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
