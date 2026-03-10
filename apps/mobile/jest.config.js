module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  transformIgnorePatterns: [
    "node_modules/(?!(react-native|@react-native|expo(nent)?|@expo|expo-router|@unimodules|unimodules|sentry-expo|nativewind)/)",
  ],
};
