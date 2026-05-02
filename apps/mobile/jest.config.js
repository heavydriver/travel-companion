module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|expo-modules-core|expo-router|nativewind|@shopify/flash-list|@sentry/react-native))",
  ],
  collectCoverage: true,
  moduleNameMapper: {
    "^@shopify/flash-list$": "<rootDir>/test/mocks/flash-list.js",
  },
  collectCoverageFrom: [
    "src/app/(auth)/*.tsx",
    "src/app/onboarding.tsx",
    "src/components/shared/BottomTabBar.tsx",
    "src/lib/utils.ts",
    "src/lib/monitoring.ts",
  ],
  coverageThreshold: {
    global: {
      statements: 70,
      branches: 70,
      functions: 70,
      lines: 70,
    },
  },
};
