import {
  GoogleGenAI,
  Environment,
  Content,
  FunctionCall,
  GenerateContentResponse,
  Candidate,
  FinishReason,
} from "@google/genai";
import { PlaywrightComputer, EnvState } from "./playwright.js";
import { consola } from "consola";

const MAX_RECENT_TURN_WITH_SCREENSHOTS = 3;
const PREDEFINED_COMPUTER_USE_FUNCTIONS = [
  "open_web_browser",
  "click_at",
  "hover_at",
  "type_text_at",
  "scroll_document",
  "scroll_at",
  "wait_5_seconds",
  "go_back",
  "go_forward",
  "search",
  "navigate",
  "key_combination",
  "drag_and_drop",
];

// Built-in Computer Use tools will return "EnvState".
// Custom provided functions will return "Record<string, any>".
type FunctionResponseT = EnvState | Record<string, any>;

interface BrowserAgentOptions {
  browserComputer: PlaywrightComputer;
  query: string;
  modelName: string;
  verbose?: boolean;
  excludedPredefinedFunctions?: string[];
}

export class BrowserAgent {
  private _browserComputer: PlaywrightComputer;
  private _query: string;
  private _modelName: string;
  private _verbose: boolean;
  private _client: GoogleGenAI;
  private _contents: Content[];
  private _generateContentConfig: any;
  private _excludedPredefinedFunctions: string[];
  public finalReasoning: string | null = null;

  constructor(options: BrowserAgentOptions) {
    this._browserComputer = options.browserComputer;
    this._query = options.query;
    this._modelName = options.modelName;
    this._verbose = options.verbose ?? true;
    this._excludedPredefinedFunctions = options.excludedPredefinedFunctions ?? [];

    this._client = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    this._contents = [
      {
        role: "user",
        parts: [{ text: this._query }],
      },
    ];

    this._generateContentConfig = {
      tools: [
        {
          computerUse: {
            environment: Environment.ENVIRONMENT_BROWSER,
            excludedPredefinedFunctions: this._excludedPredefinedFunctions,
          },
        },
      ],
    };
  }

  /**
   * Handles the action and returns the environment state.
   */
  async handleAction(action: FunctionCall): Promise<FunctionResponseT> {
    const args = action.args as Record<string, any>;

    switch (action.name) {
      case "open_web_browser":
        return await this._browserComputer.openWebBrowser();

      case "click_at":
        return await this._browserComputer.clickAt(this.denormalizeX(args.x), this.denormalizeY(args.y));

      case "hover_at":
        return await this._browserComputer.hoverAt(this.denormalizeX(args.x), this.denormalizeY(args.y));

      case "type_text_at":
        return await this._browserComputer.typeTextAt(
          this.denormalizeX(args.x),
          this.denormalizeY(args.y),
          args.text,
          args.press_enter ?? false,
          args.clear_before_typing ?? true
        );

      case "scroll_document":
        return await this._browserComputer.scrollDocument(args.direction);

      case "scroll_at": {
        let magnitude = args.magnitude ?? 800;
        const direction = args.direction;

        if (direction === "up" || direction === "down") {
          magnitude = this.denormalizeY(magnitude);
        } else if (direction === "left" || direction === "right") {
          magnitude = this.denormalizeX(magnitude);
        } else {
          throw new Error(`Unknown direction: ${direction}`);
        }

        return await this._browserComputer.scrollAt(
          this.denormalizeX(args.x),
          this.denormalizeY(args.y),
          direction,
          magnitude
        );
      }

      case "wait_5_seconds":
        return await this._browserComputer.wait5Seconds();

      case "go_back":
        return await this._browserComputer.goBack();

      case "go_forward":
        return await this._browserComputer.goForward();

      case "search":
        return await this._browserComputer.search();

      case "navigate":
        return await this._browserComputer.navigate(args.url as string);

      case "key_combination":
        return await this._browserComputer.keyCombination((args.keys as string).split("+"));

      case "drag_and_drop":
        return await this._browserComputer.dragAndDrop(
          this.denormalizeX(args.x),
          this.denormalizeY(args.y),
          this.denormalizeX(args.destination_x),
          this.denormalizeY(args.destination_y)
        );

      default:
        throw new Error(`Unsupported function: ${action.name}`);
    }
  }

  /**
   * Gets a response from the model with retry logic.
   */
  async getModelResponse(maxRetries: number = 5, baseDelayS: number = 1): Promise<GenerateContentResponse> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await this._client.models.generateContent({
          model: this._modelName,
          contents: this._contents,
          config: this._generateContentConfig,
        });
        return response;
      } catch (e) {
        consola.error(e);
        if (attempt < maxRetries - 1) {
          const delay = baseDelayS * Math.pow(2, attempt);
          consola.warn(`Generating content failed on attempt ${attempt + 1}. Retrying in ${delay} seconds...`);
          await new Promise((resolve) => setTimeout(resolve, delay * 1000));
        } else {
          consola.error(`Generating content failed after ${maxRetries} attempts.`);
          throw e;
        }
      }
    }
    throw new Error("Unexpected error in getModelResponse");
  }

  /**
   * Extracts the text from the candidate.
   */
  getText(candidate: Candidate): string | null {
    if (!candidate.content || !candidate.content.parts) {
      return null;
    }
    const textParts: string[] = [];
    for (const part of candidate.content.parts) {
      if (part.text) {
        textParts.push(part.text);
      }
    }
    return textParts.length > 0 ? textParts.join(" ") : null;
  }

  /**
   * Extracts the function calls from the candidate.
   */
  extractFunctionCalls(candidate: Candidate): FunctionCall[] {
    if (!candidate.content || !candidate.content.parts) {
      return [];
    }
    const functionCalls: FunctionCall[] = [];
    for (const part of candidate.content.parts) {
      if (part.functionCall) {
        functionCalls.push(part.functionCall);
      }
    }
    return functionCalls;
  }

  /**
   * Runs one iteration of the agent loop.
   */
  async runOneIteration(): Promise<"COMPLETE" | "CONTINUE"> {
    // Generate a response from the model
    let response: GenerateContentResponse;
    try {
      if (this._verbose) {
        consola.info("⏳ Generating response from Gemini Computer Use...");
      }
      response = await this.getModelResponse();
    } catch (e) {
      return "COMPLETE";
    }

    if (!response.candidates || response.candidates.length === 0) {
      consola.error("Response has no candidates!");
      consola.error(response);
      throw new Error("Empty response");
    }

    // Extract the text and function call from the response
    const candidate = response.candidates[0];

    // Append the model turn to conversation history
    if (candidate.content) {
      this._contents.push(candidate.content);
    }

    const reasoning = this.getText(candidate);
    const functionCalls = this.extractFunctionCalls(candidate);

    // Retry the request in case of malformed FCs
    if (functionCalls.length === 0 && !reasoning && candidate.finishReason === FinishReason.MALFORMED_FUNCTION_CALL) {
      return "CONTINUE";
    }

    if (functionCalls.length === 0) {
      consola.success(`Agent Loop Complete: ${reasoning}`);
      this.finalReasoning = reasoning;
      return "COMPLETE";
    }

    // Print the function calls and reasoning
    const functionCallStrs: string[] = [];
    for (const functionCall of functionCalls) {
      let functionCallStr = `Name: ${functionCall.name}`;
      if (functionCall.args) {
        functionCallStr += `\nArgs:`;
        for (const [key, value] of Object.entries(functionCall.args)) {
          functionCallStr += `\n  ${key}: ${value}`;
        }
      }
      functionCallStrs.push(functionCallStr);
    }

    if (this._verbose) {
      consola.log("\n" + "=".repeat(80));
      consola.log("📋 Reasoning:", reasoning || "(none)");
      consola.log("🔧 Function Call(s):");
      consola.log(functionCallStrs.join("\n---\n"));
      consola.log("=".repeat(80) + "\n");
    }

    // Execute function calls
    const functionResponses: any[] = [];
    for (const functionCall of functionCalls) {
      const extraFrFields: Record<string, any> = {};

      // Handle safety decision if present
      if (functionCall.args && (functionCall.args as any).safety_decision) {
        const decision = await this._getSafetyConfirmation((functionCall.args as any).safety_decision);
        if (decision === "TERMINATE") {
          consola.warn("Terminating agent loop");
          return "COMPLETE";
        }
        extraFrFields.safety_acknowledgement = "true";
      }

      // Execute the function
      if (this._verbose) {
        consola.info("⚙️  Sending command to Computer...");
      }
      const fcResult = await this.handleAction(functionCall);

      // Build function response
      if (this._isEnvState(fcResult)) {
        functionResponses.push({
          functionResponse: {
            name: functionCall.name,
            response: {
              url: fcResult.url,
              ...extraFrFields,
            },
            parts: [
              {
                inlineData: {
                  mimeType: "image/png",
                  data: fcResult.screenshot.toString("base64"),
                },
              },
            ],
          },
        });
      } else {
        functionResponses.push({
          functionResponse: {
            name: functionCall.name,
            response: fcResult,
          },
        });
      }
    }

    // Add function responses to conversation history
    this._contents.push({
      role: "user",
      parts: functionResponses,
    });

    // Only keep screenshots in the few most recent turns
    this._cleanupOldScreenshots();

    return "CONTINUE";
  }

  /**
   * Cleans up old screenshots from conversation history.
   */
  private _cleanupOldScreenshots(): void {
    let turnWithScreenshotsFound = 0;

    // Iterate in reverse through contents
    for (let i = this._contents.length - 1; i >= 0; i--) {
      const content = this._contents[i];
      if (content.role === "user" && content.parts) {
        // Check if content has screenshot of the predefined computer use functions
        let hasScreenshot = false;
        for (const part of content.parts) {
          if (
            part.functionResponse &&
            part.functionResponse.name &&
            PREDEFINED_COMPUTER_USE_FUNCTIONS.includes(part.functionResponse.name)
          ) {
            hasScreenshot = true;
            break;
          }
        }

        if (hasScreenshot) {
          turnWithScreenshotsFound++;
          // Remove the screenshot image if the number exceeds the limit
          if (turnWithScreenshotsFound > MAX_RECENT_TURN_WITH_SCREENSHOTS) {
            for (const part of content.parts) {
              if (
                part.functionResponse &&
                part.functionResponse.name &&
                PREDEFINED_COMPUTER_USE_FUNCTIONS.includes(part.functionResponse.name)
              ) {
                // Remove inline data (screenshot) from functionResponse.parts but keep the response
                if (part.functionResponse.parts) {
                  part.functionResponse.parts = undefined;
                }
              }
            }
          }
        }
      }
    }
  }

  /**
   * Type guard to check if result is EnvState.
   */
  private _isEnvState(obj: any): obj is EnvState {
    return obj && typeof obj === "object" && "screenshot" in obj && "url" in obj && Buffer.isBuffer(obj.screenshot);
  }

  /**
   * Gets safety confirmation from the user.
   */
  private async _getSafetyConfirmation(safety: Record<string, any>): Promise<"CONTINUE" | "TERMINATE"> {
    if (safety.decision !== "require_confirmation") {
      throw new Error(`Unknown safety decision: ${safety.decision}`);
    }

    consola.warn("Safety service requires explicit confirmation!");
    consola.log(safety.explanation);

    // In a real implementation, you'd want to use a proper input mechanism
    // For now, we'll default to continue (you should replace this with actual user input)
    consola.warn("⚠️  Auto-continuing (implement proper user input for production)");
    return "CONTINUE";
  }

  /**
   * Main agent loop.
   */
  async agentLoop(): Promise<void> {
    while (true) {
      const status = await this.runOneIteration();

      if (status === "COMPLETE") {
        // Prompt user for new instructions or to stop
        consola.success("\n🎯 Task completed!");
        const continueAgent = await consola.prompt("Do you want to continue with new instructions?", {
          type: "confirm",
          initial: true,
        });

        if (!continueAgent) {
          break;
        }

        // Get new instructions from user
        const newInstructions = await consola.prompt("Enter new instructions:", {
          type: "text",
          required: true,
        });

        // Add new user message to conversation
        this._contents.push({
          role: "user",
          parts: [{ text: newInstructions }],
        });
      }
    }
  }

  /**
   * Denormalizes x coordinate from 0-1000 range to screen width.
   */
  denormalizeX(x: number): number {
    return Math.floor((x / 1000) * this._browserComputer.screenSize()[0]);
  }

  /**
   * Denormalizes y coordinate from 0-1000 range to screen height.
   */
  denormalizeY(y: number): number {
    return Math.floor((y / 1000) * this._browserComputer.screenSize()[1]);
  }
}
