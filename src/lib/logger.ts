import * as fs from "fs";
import * as path from "path";

export class FileLogger {
  private logFilePath: string;
  private logStream: fs.WriteStream;

  constructor(startUrl: string) {
    // Extract domain from URL
    let domain = "unknown";
    try {
      const url = new URL(startUrl);
      domain = url.hostname.replace(/^www\./, "");
    } catch (e) {
      domain = startUrl.replace(/[^a-zA-Z0-9]/g, "_");
    }

    // Create timestamp
    const timestamp = new Date().toISOString().replace(/:/g, "-").replace(/\..+/, "").replace("T", "_");

    // Create logs directory if it doesn't exist
    const logsDir = path.join(process.cwd(), "logs");
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Create log file path
    this.logFilePath = path.join(logsDir, `${domain}_${timestamp}.log`);

    // Create write stream
    this.logStream = fs.createWriteStream(this.logFilePath, { flags: "a" });
  }

  log(level: string, message: string): void {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;

    // Write to file
    this.logStream.write(logLine);

    // Also write to console
    console.log(logLine.trim());
  }

  close(): void {
    this.logStream.end();
  }

  getLogFilePath(): string {
    return this.logFilePath;
  }
}
