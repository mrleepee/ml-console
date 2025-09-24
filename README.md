# ML Console

A modern, cross-platform desktop application for executing XQuery and JavaScript queries against MarkLogic databases. ML Console provides an enhanced alternative to MarkLogic's built-in Query Console with improved user experience, advanced result visualization, and comprehensive testing capabilities.

![ML Console Screenshot](docs/screenshot.png)

## 🚀 Features

### Query Execution
- **Dual Language Support**: Execute both XQuery and JavaScript queries
- **Real-time Results**: Instant query execution with live feedback
- **Multiple View Modes**: Table, Parsed Text, and Raw Output formats
- **Database Selection**: Dynamic dropdown populated with available databases
- **Keyboard Shortcuts**: `Ctrl+Enter` for quick query execution

### Interactive Query Editor
- **Smart Text Wrapping**: Automatic wrapping of selected text with brackets/quotes
  - Select text and press `(`, `[`, `{`, `"`, `'`, or `` ` `` to wrap automatically
- **Syntax-Aware**: Context-sensitive placeholders for XQuery vs JavaScript
- **Multi-line Support**: Full textarea with proper formatting and indentation

### Advanced Results Display
- **Beautiful Table View**: Card-based layout with gradient headers
  - Record numbering and URI display
  - Metadata showing Content-Type, X-Primitive, X-Path
  - Clean content preview with syntax highlighting
- **Parsed Text Mode**: Clean, formatted text output
- **Raw Output Mode**: Complete multipart/mixed response inspection

### Connection Management
- **Visual Status Indicator**: Animated status dot in header corner
  - 🟢 Green = Connected
  - 🔴 Red = Connection Error  
  - 🟡 Yellow = Connecting (with pulse animation)
  - ⚪ Gray = Ready
- **Digest Authentication**: Secure authentication with MarkLogic servers
- **Auto-reconnection**: Automatic database discovery on startup

### Testing & Debugging
- **Comprehensive Test Harness**: Built-in endpoint testing suite
  - REST API Eval endpoint validation
  - Digest Authentication testing
  - Database enumeration verification
  - Basic connectivity health checks
- **Request/Response Inspection**: Detailed debugging information
- **Performance Metrics**: Response timing and status tracking

## 🛠️ Technical Stack

- **Frontend**: React 18 + Vite
- **Desktop Framework**: Electron
- **Styling**: Pure CSS with modern features
- **Authentication**: Built-in digest auth implementation
- **Build System**: Concurrent development with hot reload

## 📦 Installation

### Prerequisites
- Node.js 16+ and npm
- MarkLogic Server running locally or remotely

### Development Setup
```bash
# Clone the repository
git clone https://github.com/your-username/ml-console.git
cd ml-console

# Install dependencies
npm install

# Start development server
npm run dev
```

### Production Build
```bash
# Build the application
npm run build

# Package for distribution (Electron)
npm run dist
```

## 🎯 Usage

### Quick Start
1. Launch ML Console
2. Configure connection settings in the header:
   - **Username**: Your MarkLogic username (default: admin)
   - **Password**: Your MarkLogic password (default: admin)
   - **Database**: Select from auto-populated dropdown
   - **Query Type**: Choose XQuery or JavaScript
3. Write your query in the editor
4. Press `Ctrl+Enter` or click "Execute" to run
5. View results in Table, Parsed, or Raw format

### Query Editor Tips
- **Smart Wrapping**: Select any text and press `(`, `[`, `{`, `"`, `'`, or `` ` `` to automatically wrap
- **Multi-line Queries**: Use the full textarea for complex queries
- **Quick Execution**: `Ctrl+Enter` works from anywhere in the editor

### Connection Status
Monitor your connection status via the indicator dot in the top-right corner:
- Hover over the dot for detailed status information
- The dot pulses yellow when connecting
- Green indicates successful connection
- Red shows connection errors

## 🏗️ Architecture

### Project Structure
```
ml-console/
├── src/
│   ├── App.jsx              # Main React component
│   ├── App.css              # Global styles
│   └── components/          # Reusable UI components
├── electron/
│   ├── main.js              # Electron main process
│   └── preload.js           # IPC security bridge
├── tests/
│   └── electron.spec.ts     # Playwright E2E tests
├── package.json             # Dependencies and scripts
├── playwright.config.ts     # Playwright configuration
├── vite.config.js           # Build configuration
└── README.md                # This file
```

### Key Components

#### Frontend (React)
- **App.jsx**: Main application with query console interface

#### Backend (Electron)
- **main.js**: Handles HTTP requests and digest authentication
- **preload.js**: Secure IPC bridge between main and renderer processes

#### Testing (Playwright)
- **electron.spec.ts**: E2E tests for Electron app functionality
- **playwright.config.ts**: Test configuration and browser settings

### Data Flow
1. User interacts with React frontend
2. Frontend communicates via IPC to Electron main process
3. Main process handles HTTP requests with digest authentication
4. Responses processed and displayed in multiple formats

## 🔧 Development

### Available Scripts
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run e2e          # Run Playwright E2E tests
npm run e2e:headed   # Run E2E tests with browser UI
npm run e2e:electron # Run Electron-specific E2E tests
```

### Development Workflow
1. **Frontend Development**: Vite dev server runs on `localhost:1420`
2. **Hot Reload**: Changes automatically refresh the Electron app
3. **Debugging**: Chrome DevTools available in development mode
4. **E2E Testing**: Playwright tests validate Electron app functionality

### Configuration
- **Server URL**: Fixed to `http://localhost:8000` (modify in App.jsx)
- **Port**: Development server runs on port 1420
- **Database**: Auto-discovered from MarkLogic server

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow existing code style and patterns
- Test new features with the built-in Test Harness
- Run E2E tests before committing: `npm run e2e:electron`
- Ensure cross-platform compatibility
- Update documentation for new features

## 📋 API Reference

### MarkLogic Endpoints
- **Primary**: `/v1/eval` - REST API query evaluation
- **Authentication**: Digest auth with realm "public"
- **Testing**: `/qconsole/endpoints/*` - Query Console endpoints

### Request Format
```javascript
// XQuery Request
{
  url: "http://localhost:8000/v1/eval",
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: "xquery=YOUR_QUERY&database=DATABASE_NAME",
  username: "admin",
  password: "admin"
}

// JavaScript Request  
{
  body: "javascript=YOUR_QUERY&database=DATABASE_NAME",
  // ... other fields same as above
}
```

## 🐛 Troubleshooting

### Common Issues

**Connection Errors**
- Verify MarkLogic server is running on port 8000
- Check username/password credentials
- Ensure digest authentication is enabled

**Query Execution Failures**
- Validate XQuery/JavaScript syntax
- Check selected database contains expected data
- Review error messages in the results panel

**Development Issues**
- Clear npm cache: `npm cache clean --force`
- Restart development server: `Ctrl+C` and `npm run dev`
- Check console for detailed error messages

### Debug Mode
Enable debug logging by opening Chrome DevTools in development mode to see detailed HTTP request/response information.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- MarkLogic for providing the powerful NoSQL database platform
- React and Electron communities for excellent documentation
- Contributors and testers who helped shape this tool

---

**Built with ❤️ for the MarkLogic developer community**
