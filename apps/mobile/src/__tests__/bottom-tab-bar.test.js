import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { BottomTabBar } from "@/components/shared/BottomTabBar";

jest.mock("expo-image", () => ({
  Image: "Image",
}));

const mockNavigation = {
  emit: jest.fn(() => ({ defaultPrevented: false })),
  navigate: jest.fn(),
};

const props = {
  state: {
    index: 0,
    routes: [
      { key: "home-key", name: "index" },
      { key: "map-key", name: "map" },
      { key: "explore-key", name: "explore" },
      { key: "assistant-key", name: "assistant" },
      { key: "itinerary-key", name: "itinerary" },
    ],
  },
  descriptors: {
    "home-key": { options: {} },
    "map-key": { options: {} },
    "explore-key": { options: {} },
    "assistant-key": { options: {} },
    "itinerary-key": { options: {} },
  },
  navigation: mockNavigation,
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
};

describe("BottomTabBar", () => {
  it("renders five tab labels", () => {
    const { getByText } = render(<BottomTabBar {...props} />);

    expect(getByText("Home")).toBeTruthy();
    expect(getByText("Map")).toBeTruthy();
    expect(getByText("Explore")).toBeTruthy();
    expect(getByText("Assistant")).toBeTruthy();
    expect(getByText("Itinerary")).toBeTruthy();
  });

  it("navigates when a tab is pressed", () => {
    const { getByText } = render(<BottomTabBar {...props} />);
    fireEvent.press(getByText("Map"));
    expect(mockNavigation.navigate).toHaveBeenCalled();
  });
});
