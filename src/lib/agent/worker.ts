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
  type: "log" | "screenshot" | "state" | "iteration";
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

// Helper functions to extract thoughts and commands from agent content
function extractThoughts(content: any): string | null {
  if (!content.parts) return null;
  const textParts: string[] = [];
  for (const part of content.parts) {
    if (part.text) {
      textParts.push(part.text);
    }
  }
  return textParts.length > 0 ? textParts.join(" ").trim() : null;
}

function extractCommands(content: any): string[] {
  if (!content.parts) return [];
  const commands: string[] = [];
  for (const part of content.parts) {
    if (part.functionCall) {
      const fc = part.functionCall;
      let commandStr = fc.name;

      // Add key arguments to make commands more descriptive
      if (fc.args) {
        const keyArgs: string[] = [];
        if (fc.args.text) keyArgs.push(`"${fc.args.text}"`);
        if (fc.args.url) keyArgs.push(`"${fc.args.url}"`);
        if (fc.args.x !== undefined && fc.args.y !== undefined) {
          keyArgs.push(`(${fc.args.x}, ${fc.args.y})`);
        }
        if (fc.args.direction) keyArgs.push(fc.args.direction);
        if (fc.args.keys) keyArgs.push(fc.args.keys);

        if (keyArgs.length > 0) {
          commandStr += `: ${keyArgs.join(", ")}`;
        }
      }

      commands.push(commandStr);
    }
  }
  return commands;
}

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

    // Patch runOneIteration to capture iteration data and handle errors
    const originalRunOneIteration = agent.runOneIteration.bind(agent);
    agent.runOneIteration = async function () {
      try {
        const result = await originalRunOneIteration();

        // After iteration, extract and send structured data
        // Access the last model response from the agent's contents
        const agentContents = (agent as any)._contents;
        if (agentContents && agentContents.length > 0) {
          // Find the last model response (role: "model" or role: "assistant")
          for (let i = agentContents.length - 1; i >= 0; i--) {
            const content = agentContents[i];
            if (content.role === "model" || content.role === "assistant") {
              const thoughts = extractThoughts(content);
              const commands = extractCommands(content);

              if (thoughts || commands.length > 0) {
                parentPort?.postMessage({
                  type: "iteration",
                  data: {
                    timestamp: Date.now(),
                    thoughts: thoughts || "(no reasoning provided)",
                    commands,
                  },
                });
              }
              break;
            }
          }
        }

        return result;
      } catch (error: any) {
        // Handle timeout and other errors gracefully
        consola.error("Error during agent iteration:", error.message);

        // Send iteration data about the error
        parentPort?.postMessage({
          type: "iteration",
          data: {
            timestamp: Date.now(),
            thoughts: `Error occurred: ${error.message}. Attempting to recover...`,
            commands: ["(error recovery)"],
          },
        });

        // Return CONTINUE to allow the agent to recover and try again
        return "CONTINUE" as const;
      }
    };

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

    // Don't close browser on normal completion - allow user to inspect or continue
    consola.success("✅ Agent loop completed. Browser remains open.");
  } catch (error: any) {
    consola.error("Error in agent execution:", error);

    // Send error iteration card
    parentPort?.postMessage({
      type: "iteration",
      data: {
        timestamp: Date.now(),
        thoughts: `Fatal error: ${error.message}. Browser remains open for inspection.`,
        commands: ["(agent stopped)"],
      },
    });

    parentPort?.postMessage({
      type: "state",
      data: "error",
    });

    // Don't close the browser on error - keep it open for debugging/recovery
    // Only close if explicitly terminated
    consola.warn("⚠️  Agent encountered an error but browser remains open.");
    consola.warn("⚠️  Use 'Finish Task' to close the browser, or 'Start New Session' to try again.");
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

  // Send error iteration card
  parentPort?.postMessage({
    type: "iteration",
    data: {
      timestamp: Date.now(),
      thoughts: `Uncaught exception: ${error.message}. Browser remains open.`,
      commands: ["(uncaught error)"],
    },
  });

  parentPort?.postMessage({
    type: "state",
    data: "error",
  });

  consola.warn("⚠️  Uncaught exception occurred but browser remains open for debugging.");
});
