# Browsafex

A web interface for controlling a Gemini-powered browser automation agent with real-time screenshot and log streaming.

## Features

- **Web Interface**: Modern, responsive Next.js UI for agent control
- **Real-time Updates**: Server-Sent Events (SSE) for live logs and screenshots
- **Multi-Session Support**: Handle multiple concurrent agent sessions
- **Persistent Logging**: All agent activity logged to files in the `logs/` directory
- **Worker Threads**: Agent runs in isolated worker threads for better performance
- **Conversational Agent**: Continue conversations with the agent after task completion

## Architecture

### Frontend

- Single-page Next.js application
- Real-time updates via SSE
- Responsive design with Tailwind CSS

### Backend

- API routes for session management
- Worker threads for agent execution
- In-memory session store
- File logging system

### Components

```
src/
├── app/
│   ├── api/
│   │   └── agent/
│   │       ├── start/route.ts    # Start new session
│   │       ├── message/route.ts  # Send message to agent
│   │       ├── finish/route.ts   # Finish session
│   │       └── events/route.ts   # SSE endpoint
│   └── page.tsx                  # Main UI
├── lib/
│   ├── agent/
│   │   ├── agent.ts              # Browser agent logic
│   │   ├── playwright.ts         # Playwright wrapper
│   │   ├── worker.ts             # Worker thread script
│   │   └── index.ts              # Public API
│   ├── session-manager.ts        # Session management
│   └── logger.ts                 # File logging
```

## Prerequisites

1. **Chrome with Remote Debugging** - Start Chrome with:

   ```bash
   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
     --remote-debugging-port=9222 \
     --user-data-dir=/tmp/chrome-debug
   ```

2. **Environment Variables** - Create a `.env.local` file:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

## Installation

```bash
# Install dependencies
yarn install

# Run development server
yarn dev
```

Visit `http://localhost:3000` to access the interface.

## Usage

### Starting a Session

1. Enter the **Start URL** (e.g., `https://www.google.com`)
2. Enter the **Initial Prompt** (e.g., "Search for TypeScript documentation")
3. Click **Start Session**

The interface will display:

- Real-time browser screenshots (1440x900 resolution)
- Agent logs with timestamps
- Current agent state (initializing, running, completed, etc.)

### Continuing a Conversation

When the agent reaches the **COMPLETED** state:

1. The **Send Message** input becomes enabled
2. Enter follow-up instructions
3. Click **Send** to continue the conversation

The agent maintains context from the previous conversation.

### Finishing a Task

Click the **Finish Task** button to:

- Terminate the worker thread
- Close the browser connection
- Clean up the session

### Starting a New Session

Click **Start New Session** to:

- Close the current SSE connection
- Reset the interface
- Start fresh with a new URL and prompt

## API Endpoints

### POST `/api/agent/start`

Start a new agent session.

**Request:**

```json
{
  "startUrl": "https://www.example.com",
  "initialPrompt": "Your instructions here"
}
```

**Response:**

```json
{
  "sessionId": "session_1234567890_abc123"
}
```

### POST `/api/agent/message`

Send a message to continue the conversation.

**Request:**

```json
{
  "sessionId": "session_1234567890_abc123",
  "message": "Follow-up instructions"
}
```

**Response:**

```json
{
  "success": true
}
```

### POST `/api/agent/finish`

Finish a session and close the browser.

**Request:**

```json
{
  "sessionId": "session_1234567890_abc123"
}
```

**Response:**

```json
{
  "success": true
}
```

### GET `/api/agent/events?sessionId=xxx`

Server-Sent Events endpoint for real-time updates.

**Event Types:**

- `log`: Agent log entries
- `screenshot`: Base64-encoded PNG screenshots
- `state`: Agent state changes

**Example Event:**

```
data: {"type":"log","data":{"timestamp":1234567890,"level":"info","content":"Starting agent..."}}

data: {"type":"screenshot","data":"base64_encoded_image..."}

data: {"type":"state","data":"running"}
```

## Log Files

All agent activity is logged to files in the `logs/` directory:

- Filename format: `{domain}_{timestamp}.log`
- Example: `logs/google.com_2025-10-15_14-30-45.log`

Each log entry includes:

- Timestamp
- Log level (INFO, SUCCESS, ERROR, WARN)
- Message content

## Session Management

The application supports multiple concurrent sessions:

- Each session has a unique ID
- Sessions are stored in memory
- Each session has its own worker thread
- Sessions include logs, screenshots, and state

## Technical Details

### Worker Thread Communication

**Main → Worker:**

```typescript
{ type: 'start', data: { startUrl, instructions } }
{ type: 'continue', data: { message } }
{ type: 'terminate' }
```

**Worker → Main:**

```typescript
{ type: 'log', data: { timestamp, level, content } }
{ type: 'screenshot', data: 'base64_string' }
{ type: 'state', data: 'running' | 'completed' | 'error' }
```

### Screenshot Capture

Screenshots are automatically captured:

- After every agent action
- Resolution: 1440x900 pixels
- Format: PNG, base64-encoded
- Transmitted via SSE to frontend

### State Management

Session states:

- `idle`: No session active
- `initializing`: Session starting
- `running`: Agent executing tasks
- `completed`: Agent waiting for new instructions
- `error`: Error occurred
- `terminated`: Session ended

## Development

```bash
# Run development server
yarn dev

# Build for production
yarn build

# Start production server
yarn start

# Run linter
yarn lint
```

## Troubleshooting

### Worker Thread Errors

If you see worker thread errors, ensure:

- `tsx` package is installed
- TypeScript files have correct imports
- Chrome is running with remote debugging

### SSE Connection Issues

If real-time updates aren't working:

- Check browser console for errors
- Verify sessionId is valid
- Check that the API route is accessible

### Screenshot Not Displaying

If screenshots don't appear:

- Verify Chrome is running on port 9222
- Check that the browser is navigating correctly
- Look for errors in agent logs

## License

MIT
