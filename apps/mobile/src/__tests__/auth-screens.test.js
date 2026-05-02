import React from "react";
import { render } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import LoginScreen from "@/app/(auth)/login";
import RegisterScreen from "@/app/(auth)/register";

jest.mock("@/api/client", () => ({
  useEden: () => ({
    api: {
      v1: {
        auth: {
          login: { post: { mutationOptions: () => ({ mutationFn: jest.fn() }) } },
          register: { post: { mutationOptions: () => ({ mutationFn: jest.fn() }) } },
        },
      },
    },
  }),
  client: {
    api: {
      v1: {
        auth: {
          login: { post: jest.fn() },
          register: { post: jest.fn() },
        },
      },
    },
  },
}));

jest.mock("@/components/shared/Screen", () => ({
  Screen: ({ children }) => children,
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({
    replace: jest.fn(),
    push: jest.fn(),
  }),
}));

describe("Auth screens", () => {
  const wrapper = ({ children }) => (
    <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
  );

  it("renders login fields and CTA", () => {
    const { getByText } = render(<LoginScreen />, { wrapper });

    expect(getByText("Welcome back")).toBeTruthy();
    expect(getByText("Login")).toBeTruthy();
  });

  it("renders register fields and CTA", () => {
    const { getAllByText, getByPlaceholderText } = render(<RegisterScreen />, { wrapper });

    expect(getAllByText("Create account").length).toBeGreaterThan(0);
    expect(getByPlaceholderText("Choose a username")).toBeTruthy();
  });
});
