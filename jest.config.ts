// IMPORTANT
// This file is currently unused!
// At the moment, the web-app is using vitest as a test runner
// instead of Jest. This decision was made for two reasons
// 1. The web-app is built using vite and using vitest as the
//    test runner allows our tests to share the same build
//    system as when building for production.
// 2. In testing, Vitest is about 2x faster in real world usage
//    than jest.
// The vitest API is largely compatible with Jests and allows
// using the same assertion libraries (e.g. `@testing-library`).
// When this decision was made, switching to Vitest was a drop
// in replacement. Additionally, while the jest config below
// works, it contains some differences from the production build
// which isn't ideal.

import type { InitialOptionsTsJest } from "ts-jest";

const config: InitialOptionsTsJest = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  testPathIgnorePatterns: ["/node_modules/"],
  collectCoverage: false,
  collectCoverageFrom: ["src/**/*.ts(x)"],
  setupFilesAfterEnv: ["<rootDir>/test-setup.ts"],
  modulePaths: ["<rootDir>/src/"],
  moduleNameMapper: {
    // Jest expects commonjs modules and doesn't transform packages in
    // node_modules by default. Replacing lodash-es with lodash in tests is
    // easy work-around.
    "^lodash-es$": "lodash",
    "^lodash-es/(.*)$": "lodash/$1",
    // This configures the jest modules name mapping to match the
    // tsconfig "paths" value of `"~/*": ["src/*"]`
    "^~/(.*)$": "<rootDir>/src/$1",
  },
};

export default config;
