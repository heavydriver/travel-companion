import "@testing-library/jest-native/extend-expect";

jest.mock("react-native-keyboard-controller", () => ({
  KeyboardAwareScrollView: ({ children }) => children,
  KeyboardProvider: ({ children }) => children,
}));
