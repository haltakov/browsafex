import { parentPort } from "worker_threads";
import { PlaywrightComputer } from "./playwright.js";
import { BrowserAgent } from "./agent.js";
import { consola, LogLevels } from "consola";
import { FileLogger } from "../logger.js";

interface WorkerMessage {
  type: "start" | "continue" | "terminate";
  data?: {
    startUrl?: string;
    instructions?: string;
    message?: string;
  };
}

interface ParentMessage {
  type: "log" | "screenshot" | "state";
  data: any;
}

let computer: PlaywrightComputer | null = null;
let agent: BrowserAgent | null = null;
let fileLogger: FileLogger | null = null;
let pendingMessage: string | null = null;
let shouldTerminate = false;

// Setup custom consola reporter to capture logs
const customReporter = {
  log(logObj: any) {
    const message = {
      type: "log" as const,
      data: {
        level:
          logObj.level === LogLevels.info
            ? "info"
            : logObj.level === LogLevels.success
            ? "success"
            : logObj.level === LogLevels.error
            ? "error"
            : logObj.level === LogLevels.warn
            ? "warn"
            : "log",
        content: logObj.args.join(" "),
        timestamp: Date.now(),
      },
    };

    // Send to parent
    parentPort?.postMessage(message);

    // Log to file
    if (fileLogger) {
      fileLogger.log(message.data.level, message.data.content);
    }

    // Also log to console for debugging
    const originalLog = console.log;
    originalLog.apply(console, logObj.args);
  },
};

consola.addReporter(customReporter);

// Intercept PlaywrightComputer's currentState to capture screenshots
async function runAgentWithCapture(startUrl: string, instructions: string) {
  try {
    // Initialize file logger
    fileLogger = new FileLogger(startUrl);

    // Send initial state
    parentPort?.postMessage({
      type: "state",
      data: "running",
    });

    // Initialize the Playwright computer
    computer = new PlaywrightComputer({
      screenSize: [1440, 900],
      initialUrl: startUrl,
      searchEngineUrl: "https://www.google.com",
      highlightMouse: true,
    });

    // Patch currentState to capture screenshots
    const originalCurrentState = computer.currentState.bind(computer);
    computer.currentState = async function () {
      const state = await originalCurrentState();
      // Send screenshot to parent
      parentPort?.postMessage({
        type: "screenshot",
        data: state.screenshot.toString("base64"),
      });
      return state;
    };

    // Start the browser
    await computer.start();

    // Create the browser agent
    agent = new BrowserAgent({
      browserComputer: computer,
      query: instructions,
      modelName: "gemini-2.5-computer-use-preview-10-2025",
      verbose: true,
      excludedPredefinedFunctions: ["drag_and_drop"],
    });

    // Run the agent loop with custom completion handler
    consola.info("🚀 Starting browser agent...\n");
    await agent.agentLoop(async () => {
      // When agent completes, notify parent and wait for new instructions
      parentPort?.postMessage({
        type: "state",
        data: "completed",
      });

      if (agent?.finalReasoning) {
        consola.success("\n✅ Final Result:");
        consola.log(agent.finalReasoning);
      }

      // Wait for new message or termination
      while (!pendingMessage && !shouldTerminate) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      if (shouldTerminate) {
        return null;
      }

      const message = pendingMessage;
      pendingMessage = null;

      // Update state back to running
      parentPort?.postMessage({
        type: "state",
        data: "running",
      });

      return message;
    });

    // Agent loop completed normally
    parentPort?.postMessage({
      type: "state",
      data: "completed",
    });
  } catch (error) {
    consola.error("Error in agent execution:", error);
    parentPort?.postMessage({
      type: "state",
      data: "error",
    });
  } finally {
    // Clean up
    if (computer) {
      await computer.stop();
      consola.info("\n🛑 Browser closed.");
    }
    if (fileLogger) {
      fileLogger.close();
    }
  }
}

// Handle messages from parent thread
parentPort?.on("message", (message: WorkerMessage) => {
  if (message.type === "start") {
    const { startUrl, instructions } = message.data || {};
    if (startUrl && instructions) {
      runAgentWithCapture(startUrl, instructions);
    }
  } else if (message.type === "continue") {
    const { message: userMessage } = message.data || {};
    if (userMessage) {
      pendingMessage = userMessage;
    }
  } else if (message.type === "terminate") {
    shouldTerminate = true;
    if (computer) {
      computer.stop().then(() => {
        if (fileLogger) {
          fileLogger.close();
        }
        process.exit(0);
      });
    } else {
      if (fileLogger) {
        fileLogger.close();
      }
      process.exit(0);
    }
  }
});

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  consola.error("Uncaught exception in worker:", error);
  parentPort?.postMessage({
    type: "state",
    data: "error",
  });
});
