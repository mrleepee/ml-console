import '@testing-library/jest-dom'

// Mock Electron API for testing
global.window = {
  ...global.window,
  electronAPI: {
    httpRequest: vi.fn(),
    database: {
      saveQuery: vi.fn(),
      getQueries: vi.fn(),
      deleteQuery: vi.fn(),
    }
  }
}

// Mock console methods to capture logs during tests
const originalConsoleLog = console.log
const originalConsoleError = console.error

global.mockConsoleCapture = {
  logs: [],
  errors: []
}

console.log = (...args) => {
  global.mockConsoleCapture.logs.push(args)
  originalConsoleLog(...args)
}

console.error = (...args) => {
  global.mockConsoleCapture.errors.push(args)
  originalConsoleError(...args)
}

// Reset mocks before each test
beforeEach(() => {
  global.mockConsoleCapture.logs = []
  global.mockConsoleCapture.errors = []
  vi.clearAllMocks()
})