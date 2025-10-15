import { Worker } from "worker_threads";
import { EventEmitter } from "events";

export interface LogEntry {
  timestamp: number;
  level: "info" | "success" | "error" | "warn" | "log";
  content: string;
}

export interface AgentIteration {
  timestamp: number;
  thoughts: string;
  commands: string[];
}

export interface SessionData {
  id: string;
  startUrl: string;
  worker: Worker | null;
  logs: LogEntry[];
  screenshots: string[]; // base64 encoded
  iterations: AgentIteration[];
  state: "initializing" | "running" | "completed" | "error" | "terminated";
  createdAt: number;
  eventEmitter: EventEmitter;
}

class SessionManager {
  private sessions: Map<string, SessionData> = new Map();

  createSession(startUrl: string): SessionData {
    const sessionId = this.generateSessionId();
    const session: SessionData = {
      id: sessionId,
      startUrl,
      worker: null,
      logs: [],
      screenshots: [],
      iterations: [],
      state: "initializing",
      createdAt: Date.now(),
      eventEmitter: new EventEmitter(),
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId: string): SessionData | undefined {
    return this.sessions.get(sessionId);
  }

  updateSession(sessionId: string, updates: Partial<SessionData>): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      Object.assign(session, updates);
    }
  }

  addLog(sessionId: string, log: LogEntry): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.logs.push(log);
      session.eventEmitter.emit("log", log);
    }
  }

  addScreenshot(sessionId: string, screenshot: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.screenshots.push(screenshot);
      session.eventEmitter.emit("screenshot", screenshot);
    }
  }

  updateState(sessionId: string, state: SessionData["state"]): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.state = state;
      session.eventEmitter.emit("state", state);
    }
  }

  addIteration(sessionId: string, iteration: AgentIteration): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.iterations.push(iteration);
      session.eventEmitter.emit("iteration", iteration);
    }
  }

  deleteSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      // Terminate worker if still running
      if (session.worker) {
        session.worker.terminate();
      }
      session.eventEmitter.removeAllListeners();
      this.sessions.delete(sessionId);
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

// Ensure singleton across Next.js hot reloads in development
// Use globalThis to store the instance
const globalForSessionManager = globalThis as unknown as {
  sessionManager: SessionManager | undefined;
};

export const sessionManager = globalForSessionManager.sessionManager ?? new SessionManager();

if (process.env.NODE_ENV !== "production") {
  globalForSessionManager.sessionManager = sessionManager;
}
