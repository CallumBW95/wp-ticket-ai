/** @type {import('jest').Config} */
export default {
  preset: "ts-jest/presets/default-esm",
  extensionsToTreatAsEsm: [".ts"],
  testEnvironment: "node",
  roots: ["<rootDir>/server", "<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.(ts|js)", "**/*.(test|spec).(ts|js)"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        useESM: true,
      },
    ],
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  collectCoverageFrom: [
    "server/**/*.{ts,tsx}",
    "src/**/*.{ts,tsx}",
    "!server/**/*.d.ts",
    "!src/**/*.d.ts",
    "!**/node_modules/**",
    "!**/dist/**",
    "!**/coverage/**",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  testTimeout: 30000,
  // Ignore frontend tests for now since we're focusing on backend
  testPathIgnorePatterns: [
    "/node_modules/",
    "/dist/",
    "/coverage/",
    "src/.*\\.test\\.(ts|tsx)$", // Ignore frontend tests for now
  ],
  // Environment variables for testing
  setupFiles: ["<rootDir>/tests/env.setup.ts"],
  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,
  // Handle ES modules properly
  transformIgnorePatterns: ["node_modules/(?!(.*\\.mjs$))"],
};
