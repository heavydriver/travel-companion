import React from "react";
import { render } from "@testing-library/react-native";
import LoginScreen from "@/app/(auth)/login";
import RegisterScreen from "@/app/(auth)/register";

jest.mock("expo-router", () => ({
  useRouter: () => ({
    replace: jest.fn(),
    push: jest.fn(),
  }),
}));

describe("Auth screens", () => {
  it("renders login fields and CTA", () => {
    const { getByText } = render(<LoginScreen />);

    expect(getByText("Welcome back")).toBeTruthy();
    expect(getByText("Login")).toBeTruthy();
  });

  it("renders register fields and CTA", () => {
    const { getByText } = render(<RegisterScreen />);

    expect(getByText("Create account")).toBeTruthy();
    expect(getByText("Choose a username")).toBeTruthy();
  });
});
