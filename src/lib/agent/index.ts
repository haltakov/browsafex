import { PlaywrightComputer } from "./playwright.js";
import { BrowserAgent } from "./agent.js";
import { consola } from "consola";

export async function run_agent(start_url: string, instructions: string) {
  // Initialize the Playwright computer
  const computer = new PlaywrightComputer({
    screenSize: [1440, 900],
    initialUrl: start_url,
    searchEngineUrl: "https://www.google.com",
    highlightMouse: true,
  });

  // Start the browser
  await computer.start();

  try {
    // Create the browser agent
    const agent = new BrowserAgent({
      browserComputer: computer,
      query: instructions,
      modelName: "gemini-2.5-computer-use-preview-10-2025",
      verbose: true,
      excludedPredefinedFunctions: ["drag_and_drop"],
    });

    // Run the agent loop
    consola.info("🚀 Starting browser agent...\n");
    await agent.agentLoop();

    // Print final reasoning
    if (agent.finalReasoning) {
      consola.success("\n✅ Final Result:");
      consola.log(agent.finalReasoning);
    }
  } finally {
    // Clean up
    // await computer.stop();
    // consola.info("\n🛑 Browser closed.");
  }
}
