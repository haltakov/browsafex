import { chromium, Browser, BrowserContext, Page } from "playwright";
import { consola } from "consola";
import { Kernel } from "@onkernel/sdk";

// Mapping of keys to Playwright keys
const PLAYWRIGHT_KEY_MAP: Record<string, string> = {
  backspace: "Backspace",
  tab: "Tab",
  return: "Enter", // Playwright uses 'Enter'
  enter: "Enter",
  shift: "Shift",
  control: "ControlOrMeta",
  alt: "Alt",
  escape: "Escape",
  space: "Space", // Can also just be " "
  pageup: "PageUp",
  pagedown: "PageDown",
  end: "End",
  home: "Home",
  left: "ArrowLeft",
  up: "ArrowUp",
  right: "ArrowRight",
  down: "ArrowDown",
  insert: "Insert",
  delete: "Delete",
  semicolon: ";", // For actual character ';'
  equals: "=", // For actual character '='
  multiply: "Multiply", // NumpadMultiply
  add: "Add", // NumpadAdd
  separator: "Separator", // Numpad specific
  subtract: "Subtract", // NumpadSubtract, or just '-' for character
  decimal: "Decimal", // NumpadDecimal, or just '.' for character
  divide: "Divide", // NumpadDivide, or just '/' for character
  f1: "F1",
  f2: "F2",
  f3: "F3",
  f4: "F4",
  f5: "F5",
  f6: "F6",
  f7: "F7",
  f8: "F8",
  f9: "F9",
  f10: "F10",
  f11: "F11",
  f12: "F12",
  command: "Meta", // 'Meta' is Command on macOS, Windows key on Windows
};

export interface EnvState {
  screenshot: Buffer;
  url: string;
}

export class PlaywrightComputer {
  private _initialUrl: string;
  private _screenSize: [number, number];
  private _searchEngineUrl: string;
  private _highlightMouse: boolean;
  private _browser?: Browser;
  private _context?: BrowserContext;
  private _page?: Page;
  private _kernelBrowser?: any; // Kernel browser instance for cleanup

  /**
   * Connects to a local Playwright instance.
   */
  constructor(options: {
    screenSize: [number, number];
    initialUrl?: string;
    searchEngineUrl?: string;
    highlightMouse?: boolean;
  }) {
    this._screenSize = options.screenSize;
    this._initialUrl = options.initialUrl || "https://www.google.com";
    this._searchEngineUrl = options.searchEngineUrl || "https://www.google.com";
    this._highlightMouse = options.highlightMouse || false;
  }

  /**
   * The Computer Use model only supports a single tab at the moment.
   *
   * Some websites, however, try to open links in a new tab.
   * For those situations, we intercept the page-opening behavior, and instead overwrite the current page.
   */
  private async _handleNewPage(newPage: Page): Promise<void> {
    const newUrl = newPage.url();
    await newPage.close();
    await this._page!.goto(newUrl);
  }

  /**
   * Helper method to wait for page load with graceful timeout handling.
   * If the timeout is reached, it logs a warning and continues anyway.
   */
  private async _waitForLoadStateSafe(): Promise<void> {
    try {
      await this._page!.waitForLoadState("load", { timeout: 60000 });
    } catch {
      // If waitForLoadState times out, log warning and continue
      // The page might still be in a usable state even if not fully loaded
      consola.warn("Page still loading after timeout, continuing anyway...");
    }
  }

  async start(): Promise<this> {
    // Check if Kernel API key is provided
    if (process.env.KERNEL_API_KEY) {
      consola.info("Using Kernel browser service...");

      try {
        const kernel = new Kernel({ apiKey: process.env.KERNEL_API_KEY });
        this._kernelBrowser = await kernel.browsers.create();

        consola.info(`Connecting to Kernel browser at ${this._kernelBrowser.cdp_ws_url}...`);
        this._browser = await chromium.connectOverCDP(this._kernelBrowser.cdp_ws_url);

        consola.success("Connected to Kernel browser instance.");
      } catch (error) {
        consola.error("Failed to create Kernel browser:", error);
        throw new Error(`Failed to create Kernel browser: ${error}`);
      }
    } else {
      const browserUrl = process.env.BROWSER_URL || "http://localhost:9222";
      consola.info(`Connecting to existing Chrome instance at ${browserUrl}...`);
      this._browser = await chromium.connectOverCDP(browserUrl);
      consola.success("Connected to existing Chrome instance.");
    }

    // Create a new context for each session to ensure isolation
    // Each session will have its own cookies, localStorage, and authentication state
    this._context = await this._browser.newContext();

    this._page = await this._context.newPage();

    // Set the viewport size after creating the page
    await this._page.setViewportSize({
      width: this._screenSize[0],
      height: this._screenSize[1],
    });

    // Set default timeout to 60 seconds for all operations
    this._page.setDefaultTimeout(60000);

    await this._page.goto(this._initialUrl);

    this._context.on("page", (newPage) => this._handleNewPage(newPage));

    return this;
  }

  async stop(): Promise<void> {
    if (this._context) {
      await this._context.close();
    }

    // Terminate Kernel browser if it was created
    if (this._kernelBrowser) {
      try {
        consola.info("Terminating Kernel browser...");
        await this._kernelBrowser.terminate();
        consola.success("Kernel browser terminated successfully.");
      } catch (error) {
        consola.error("Failed to terminate Kernel browser:", error);
      }
    }
  }

  async openWebBrowser(): Promise<EnvState> {
    return this.currentState();
  }

  async clickAt(x: number, y: number): Promise<EnvState> {
    await this.highlightMouse(x, y);
    await this._page!.mouse.click(x, y);
    await this._waitForLoadStateSafe();
    return this.currentState();
  }

  async hoverAt(x: number, y: number): Promise<EnvState> {
    await this.highlightMouse(x, y);
    await this._page!.mouse.move(x, y);
    await this._waitForLoadStateSafe();
    return this.currentState();
  }

  async typeTextAt(
    x: number,
    y: number,
    text: string,
    pressEnter: boolean = false,
    clearBeforeTyping: boolean = true
  ): Promise<EnvState> {
    await this.highlightMouse(x, y);
    await this._page!.mouse.click(x, y);
    await this._waitForLoadStateSafe();

    if (clearBeforeTyping) {
      if (process.platform === "darwin") {
        await this.keyCombination(["Command", "A"]);
      } else {
        await this.keyCombination(["Control", "A"]);
      }
      await this.keyCombination(["Delete"]);
    }

    await this._page!.keyboard.type(text);
    await this._waitForLoadStateSafe();

    if (pressEnter) {
      await this.keyCombination(["Enter"]);
    }
    await this._waitForLoadStateSafe();
    return this.currentState();
  }

  private async _horizontalDocumentScroll(direction: "left" | "right"): Promise<EnvState> {
    // Scroll by 50% of the viewport size.
    const horizontalScrollAmount = this.screenSize()[0] / 2;
    const sign = direction === "left" ? "-" : "";
    const scrollArgument = `${sign}${horizontalScrollAmount}`;
    // Scroll using JS.
    await this._page!.evaluate(`window.scrollBy(${scrollArgument}, 0);`);
    await this._waitForLoadStateSafe();
    return this.currentState();
  }

  async scrollDocument(direction: "up" | "down" | "left" | "right"): Promise<EnvState> {
    if (direction === "down") {
      return this.keyCombination(["PageDown"]);
    } else if (direction === "up") {
      return this.keyCombination(["PageUp"]);
    } else if (direction === "left" || direction === "right") {
      return this._horizontalDocumentScroll(direction);
    } else {
      throw new Error("Unsupported direction: " + direction);
    }
  }

  async scrollAt(
    x: number,
    y: number,
    direction: "up" | "down" | "left" | "right",
    magnitude: number = 800
  ): Promise<EnvState> {
    await this.highlightMouse(x, y);

    await this._page!.mouse.move(x, y);
    await this._waitForLoadStateSafe();

    let dx = 0;
    let dy = 0;
    if (direction === "up") {
      dy = -magnitude;
    } else if (direction === "down") {
      dy = magnitude;
    } else if (direction === "left") {
      dx = -magnitude;
    } else if (direction === "right") {
      dx = magnitude;
    } else {
      throw new Error("Unsupported direction: " + direction);
    }

    await this._page!.mouse.wheel(dx, dy);
    await this._waitForLoadStateSafe();
    return this.currentState();
  }

  async wait5Seconds(): Promise<EnvState> {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    return this.currentState();
  }

  async goBack(): Promise<EnvState> {
    await this._page!.goBack();
    await this._waitForLoadStateSafe();
    return this.currentState();
  }

  async goForward(): Promise<EnvState> {
    await this._page!.goForward();
    await this._waitForLoadStateSafe();
    return this.currentState();
  }

  async search(): Promise<EnvState> {
    return this.navigate(this._searchEngineUrl);
  }

  async navigate(url: string): Promise<EnvState> {
    let normalizedUrl = url;
    if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
      normalizedUrl = "https://" + normalizedUrl;
    }
    await this._page!.goto(normalizedUrl);
    await this._waitForLoadStateSafe();
    return this.currentState();
  }

  async keyCombination(keys: string[]): Promise<EnvState> {
    // Normalize all keys to the Playwright compatible version.
    const normalizedKeys = keys.map((k) => PLAYWRIGHT_KEY_MAP[k.toLowerCase()] || k);

    // Press and hold all keys except the last one
    for (const key of normalizedKeys.slice(0, -1)) {
      await this._page!.keyboard.down(key);
    }

    // Press the last key
    await this._page!.keyboard.press(normalizedKeys[normalizedKeys.length - 1]);

    // Release all keys in reverse order
    for (const key of normalizedKeys.slice(0, -1).reverse()) {
      await this._page!.keyboard.up(key);
    }

    return this.currentState();
  }

  async dragAndDrop(x: number, y: number, destinationX: number, destinationY: number): Promise<EnvState> {
    await this.highlightMouse(x, y);
    await this._page!.mouse.move(x, y);
    await this._waitForLoadStateSafe();
    await this._page!.mouse.down();
    await this._waitForLoadStateSafe();

    await this.highlightMouse(destinationX, destinationY);
    await this._page!.mouse.move(destinationX, destinationY);
    await this._waitForLoadStateSafe();
    await this._page!.mouse.up();
    return this.currentState();
  }

  async currentState(): Promise<EnvState> {
    await this._waitForLoadStateSafe();

    // Even if Playwright reports the page as loaded, it may not be so.
    // Add a manual sleep to make sure the page has finished rendering.
    await new Promise((resolve) => setTimeout(resolve, 500));
    const screenshotBytes = await this._page!.screenshot({ type: "png", fullPage: false });
    return {
      screenshot: screenshotBytes,
      url: this._page!.url(),
    };
  }

  screenSize(): [number, number] {
    const viewportSize = this._page?.viewportSize();
    // If available, try to take the local playwright viewport size.
    if (viewportSize) {
      return [viewportSize.width, viewportSize.height];
    }
    // If unavailable, fall back to the original provided size.
    return this._screenSize;
  }

  async highlightMouse(x: number, y: number): Promise<void> {
    if (!this._highlightMouse) {
      return;
    }
    await this._page!.evaluate(
      (coords) => {
        const elementId = "playwright-feedback-circle";
        const div = document.createElement("div");
        div.id = elementId;
        div.style.pointerEvents = "none";
        div.style.border = "4px solid red";
        div.style.borderRadius = "50%";
        div.style.width = "20px";
        div.style.height = "20px";
        div.style.position = "fixed";
        div.style.zIndex = "9999";
        document.body.appendChild(div);

        div.hidden = false;
        div.style.left = coords.x - 10 + "px";
        div.style.top = coords.y - 10 + "px";

        setTimeout(() => {
          div.hidden = true;
        }, 2000);
      },
      { x, y }
    );
    // Wait a bit for the user to see the cursor.
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
