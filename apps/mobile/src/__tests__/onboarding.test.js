import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import OnboardingScreen from "@/app/onboarding";

const replaceMock = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    replace: replaceMock,
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

  it("navigates to login when skip is tapped", () => {
    const { getByText } = render(<OnboardingScreen />);

    fireEvent.press(getByText("Skip intro"));
    expect(replaceMock).toHaveBeenCalled();
  });
});
