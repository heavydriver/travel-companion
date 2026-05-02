import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import OnboardingScreen from "@/app/onboarding";

const mockReplace = jest.fn();
const mockSetHasSeenOnboarding = jest.fn(() => Promise.resolve());

jest.mock("@/components/shared/Screen", () => ({
  Screen: ({ children }) => children,
}));

jest.mock("nativewind", () => ({
  useUnstableNativeVariable: () => "217 91% 60%",
}));

jest.mock("@/store/uiStore", () => ({
  useUiStore: (selector) =>
    selector({
      setHasSeenOnboarding: mockSetHasSeenOnboarding,
    }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

jest.mock("expo-image", () => ({
  Image: "Image",
}));

describe("OnboardingScreen", () => {
  it("renders onboarding slide content", () => {
    const { getByText } = render(<OnboardingScreen />);

    expect(getByText("Explore new places")).toBeTruthy();
    expect(getByText("Login")).toBeTruthy();
    expect(getByText("Create account")).toBeTruthy();
  });

  it("navigates to login when skip is tapped", async () => {
    const { getByText } = render(<OnboardingScreen />);

    fireEvent.press(getByText("Skip"));
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalled();
    });
  });
});
