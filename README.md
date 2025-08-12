# WP Aggregator AI Chat Bot

A web-based chat bot built with React, TypeScript, and Node.js that uses Google Gemini as the LLM and connects to a WordPress MCP (Model Context Protocol) server for enhanced WordPress-related assistance.

## Features

- 🤖 **Google Gemini Integration**: Powered by Google's Gemini 1.5 Flash model
- 🔌 **MCP Server Connectivity**: Connects to WordPress.org MCP server for enhanced WordPress knowledge
- 🗄️ **MongoDB Ticket Database**: Comprehensive WordPress Trac ticket storage and search
- 🕷️ **WordPress Trac Scraper**: Automated scraping of tickets, comments, attachments, and changesets
- ⚛️ **Modern React UI**: Built with React 18, TypeScript, and Vite
- 🎨 **Responsive Design**: Works on desktop and mobile devices
- 🌙 **Dark/Light Mode**: Automatic theme detection based on system preferences
- 🛠️ **Function Calling**: Supports both MCP tools and custom ticket search functions
- 📊 **Advanced Search**: Full-text search across tickets, comments, and metadata
- 🔄 **Real-time Updates**: Scheduled scraping to keep ticket data current

## Prerequisites

- Node.js 18+ and npm
- Google Gemini API key
- MongoDB Atlas account (free tier available)

## Getting Started

1. **Clone and install dependencies:**

   ```bash
   npm install
   ```

2. **Set up environment variables:**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and configure:

   ```
   # Google Gemini API Key
   VITE_GEMINI_API_KEY=your_actual_api_key_here

   # MongoDB Atlas Connection String
   MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/wp-aggregator-ai?retryWrites=true&w=majority

   # Server Configuration
   PORT=3001
   NODE_ENV=development

   # Enable scraping (optional)
   ENABLE_SCRAPING=false
   ```

3. **Port Configuration (Optional):**

   The development environment automatically handles port conflicts, but you can specify custom ports:

   ```bash
   # Frontend port (default: auto-find from 3000)
   FRONTEND_PORT=3000
   # Alternative: VITE_PORT=3000

   # Backend port (default: auto-find from 3001)  
   BACKEND_PORT=3001
   # Alternative: PORT=3001
   ```

   **Port Auto-Switching**: If no custom ports are specified, the system will automatically find available ports starting from 3000 (frontend) and 3001 (backend).

4. **Start the development environment:**

   ```bash
   # Start both frontend and backend (recommended)
   npm run dev

   # Start with tests first (if you want to ensure tests pass)
   npm run dev:safe

   # Start only the backend server
   npm run server

   # Start only the frontend
   npm run dev:client
   ```

5. **Production deployment:**

   ```bash
   # Build the project
   npm run build

   # Start production server
   npm start
   ```

## Error Handling & Troubleshooting

The server now provides **clear, actionable error messages** to help you quickly identify and fix startup issues:

### 🚫 **Database Connection Errors**

If you see database connection errors:

```
❌ CRITICAL ERROR: Failed to connect to MongoDB!
🔧 This usually means:
   1. Your MongoDB Atlas cluster is not running
   2. Your IP address is not whitelisted
   3. Your username/password is incorrect
   4. Network connectivity issues
```

**Quick fixes:**
- ✅ Check your `.env` file has the correct `MONGODB_URI`
- ✅ Verify your MongoDB Atlas cluster is running
- ✅ Whitelist your IP address in MongoDB Atlas
- ✅ Test your connection string in MongoDB Compass

### 🔌 **Port Conflicts**

If you see port conflicts:

```
❌ No available ports found in range 3001-3010!
🔧 All ports in this range are currently in use.
💡 Try:
   1. Stopping other services using these ports
   2. Using a different port range
   3. Setting a custom port via PORT environment variable
```

**Quick fixes:**
- ✅ Kill processes using the ports: `lsof -ti:3001 | xargs kill -9`
- ✅ Set a custom port: `PORT=4000 npm run dev`
- ✅ Use the auto-port-finding feature (default behavior)

### 🔑 **Missing Environment Variables**

If you see missing environment variable errors:

```
❌ CRITICAL ERROR: MONGODB_URI environment variable is missing!
🔧 To fix this:
   1. Create a .env file in your project root
   2. Add: MONGODB_URI=your_mongodb_connection_string
   3. Get your connection string from MongoDB Atlas
```

**Quick fixes:**
- ✅ Copy `.env.example` to `.env`
- ✅ Fill in your actual API keys and database URI
- ✅ Restart the server

### 🧪 **Test Failures**

If tests are failing and blocking startup:

```bash
# Use the safe dev script that requires tests to pass
npm run dev:safe

# Or use the regular dev script that skips tests
npm run dev
```

### 📊 **Health Check**

Once running, check server health:

```bash
# Health check endpoint
curl http://localhost:3001/health

# Response includes:
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "database": "connected",
  "uptime": 123.45
}
```

### 🛑 **Graceful Shutdown**

The server handles shutdown signals gracefully:

- **Ctrl+C**: Gracefully shuts down both frontend and backend
- **SIGTERM**: Production shutdown signal
- **Database connections**: Properly closed to prevent data corruption

4. **Set up MongoDB Atlas (Cloud Database):**

   We use MongoDB Atlas for a reliable, cloud-based database:

   1. **Create a free MongoDB Atlas account:**

      - Visit [MongoDB Atlas](https://www.mongodb.com/atlas)
      - Sign up for a free account

   2. **Create a new cluster:**

      - Click "Create a Cluster"
      - Choose the "FREE" tier (M0 Sandbox)
      - Select a cloud provider and region close to you
      - Name your cluster (e.g., "wp-aggregator-cluster")
      - Click "Create Cluster"

   3. **Set up database access:**

      - Go to "Database Access" in the left sidebar
      - Click "Add New Database User"
      - Choose "Password" authentication
      - Create a username and secure password
      - Set privileges to "Read and write to any database"
      - Click "Add User"

   4. **Configure network access:**

      - Go to "Network Access" in the left sidebar
      - Click "Add IP Address"
      - For development, click "Allow Access from Anywhere" (0.0.0.0/0)
      - For production, add your specific IP addresses
      - Click "Confirm"

   5. **Get your connection string:**
      - Go back to "Clusters"
      - Click "Connect" on your cluster
      - Choose "Connect your application"
      - Copy the connection string
      - Replace `<password>` with your actual database user password
      - Update `MONGODB_URI` in your `.env` file

   **Example connection string:**

   ```
   MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/wp-aggregator-ai?retryWrites=true&w=majority
   ```

   📋 **Need more help?** See the detailed [MongoDB Atlas Setup Guide](./MONGODB_ATLAS_SETUP.md)

5. **Start the development server:**

   ```bash
   npm run dev
   ```

   This starts both the React frontend (port 3000) and Express API server (port 3001)

6. **Open your browser:**
   Navigate to `http://localhost:3000`

7. **Populate the ticket database (optional):**

   ```bash
   # Scrape recent tickets
   npm run scrape recent 50

   # Scrape a specific ticket
   npm run scrape ticket 12345

   # Bulk scrape (be respectful to WordPress.org)
   npm run scrape bulk 100
   ```

## Getting a Gemini API Key

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated API key to your `.env` file

## Architecture

### Core Components

- **App.tsx**: Main application component with service initialization
- **ChatBot.tsx**: Main chat interface component
- **MessageList.tsx**: Displays conversation messages
- **MessageInput.tsx**: Input component for user messages

### Services

- **gemini.ts**: Google Gemini API integration with function calling support
- **mcp.ts**: Model Context Protocol client for WordPress server
- **initialization.ts**: Service initialization and configuration

### MCP Integration

The application connects to the WordPress MCP server at:
`https://mcp-server-wporg-trac-staging.a8cai.workers.dev/mcp`

This provides the chat bot with access to WordPress-specific tools and knowledge, enabling it to:

- Answer WordPress development questions
- Provide information about WordPress core, plugins, and themes
- Access WordPress.org resources and documentation
- Help with troubleshooting and best practices

## Development

### Available Scripts

- `npm run dev` - Start both frontend and backend development servers
- `npm run dev:client` - Start only the React frontend
- `npm run server` - Start only the Express API server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run scrape` - Run the WordPress Trac scraper

### Project Structure

```
src/
├── components/          # React components
│   ├── ChatBot.tsx     # Main chat interface
│   ├── MessageList.tsx # Message display component
│   └── MessageInput.tsx # Input component
├── services/           # Service layer
│   ├── gemini.ts      # Gemini API integration
│   ├── mcp.ts         # MCP client
│   ├── tickets.ts     # Ticket database integration
│   └── initialization.ts # Service setup
├── types/             # TypeScript type definitions
│   └── index.ts
├── App.tsx           # Main app component
├── App.css          # App styles
├── main.tsx         # React entry point
└── index.css        # Global styles

server/
├── config/            # Server configuration
│   └── database.ts    # MongoDB connection
├── models/            # Database models
│   └── Ticket.ts      # Ticket schema and model
├── routes/            # API routes
│   └── tickets.ts     # Ticket API endpoints
├── scraper/           # WordPress Trac scraper
│   ├── TracScraper.ts # Main scraper class
│   ├── index.ts       # Scraper CLI
│   └── scheduler.ts   # Automated scraping
└── index.ts          # Express server entry point
```

## Deployment

1. **Build the application:**

   ```bash
   npm run build
   ```

2. **Deploy the `dist` folder** to your preferred hosting service (Vercel, Netlify, etc.)

3. **Set environment variables** in your hosting platform's dashboard

## WordPress Trac Integration

The chat bot now includes comprehensive WordPress Trac ticket integration:

### Ticket Search Capabilities

- **Full-text search**: Search across ticket titles, descriptions, and comments
- **Component filtering**: Find tickets by WordPress component (Editor, Media, Themes, etc.)
- **Status filtering**: Filter by ticket status (new, assigned, closed, etc.)
- **Priority filtering**: Filter by priority level (trivial to blocker)
- **Recent tickets**: Get recently updated tickets
- **Detailed ticket info**: Access complete ticket data including comments and attachments

### Scraper Features

- **Respectful scraping**: Built-in delays and rate limiting
- **Comprehensive data**: Extracts tickets, comments, attachments, and changesets
- **Incremental updates**: Updates existing tickets with new information
- **Bulk operations**: Support for bulk scraping with progress tracking
- **Scheduled updates**: Optional automated scraping for fresh data

### API Endpoints

- `GET /api/tickets` - List tickets with filtering and pagination
- `GET /api/tickets/:ticketId` - Get specific ticket details
- `GET /api/tickets/search/:query` - Full-text search
- `GET /api/tickets/recent/:days` - Recent tickets
- `GET /api/tickets/stats/summary` - Ticket statistics

## Troubleshooting

### Common Issues

- **"Gemini not initialized" error**: Ensure your `VITE_GEMINI_API_KEY` is set correctly
- **MCP connection issues**: The app will continue to work without MCP tools if the server is unavailable
- **MongoDB connection errors**: Check your `MONGODB_URI` connection string and ensure your IP is whitelisted in Atlas Network Access
- **Build errors**: Make sure all dependencies are installed with `npm install`
- **Scraper issues**: Respect WordPress.org servers - use reasonable delays between requests

### Browser Compatibility

This application requires a modern browser with support for:

- ES2020+ features
- Fetch API
- CSS Grid and Flexbox

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and commit them
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

## License

This project is licensed under the MIT License.
