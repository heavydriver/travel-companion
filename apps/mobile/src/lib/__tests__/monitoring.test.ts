const mockInit = jest.fn();
const mockSetUser = jest.fn();
const mockSetTag = jest.fn();
const mockCaptureException = jest.fn();

jest.mock("@sentry/react-native", () => ({
  init: (...args: unknown[]) => mockInit(...args),
  setUser: (...args: unknown[]) => mockSetUser(...args),
  setTag: (...args: unknown[]) => mockSetTag(...args),
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

describe("monitoring", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("initializes Sentry once and keeps only userId metadata", () => {
    const { initMonitoring } = require("@/lib/monitoring");
    initMonitoring();
    initMonitoring();

    expect(mockInit).toHaveBeenCalledTimes(1);
    const config = mockInit.mock.calls[0][0];
    const event = config.beforeSend?.({
      user: { id: "user_123", email: "secret@example.com" },
      request: { headers: { authorization: "Bearer secret" } },
    });

    expect(event.user).toEqual({ id: "user_123" });
    expect(event.request.headers.authorization).toBeUndefined();
  });

  it("updates Sentry user, screen, and captures errors", () => {
    const { setMonitoringUser, setMonitoringScreen, captureMonitoringError } =
      require("@/lib/monitoring");

    setMonitoringUser("abc");
    setMonitoringUser(null);
    setMonitoringScreen("/profile");
    captureMonitoringError(new Error("boom"));

    expect(mockSetUser).toHaveBeenCalledWith({ id: "abc" });
    expect(mockSetUser).toHaveBeenCalledWith(null);
    expect(mockSetTag).toHaveBeenCalledWith("screen_name", "/profile");
    expect(mockCaptureException).toHaveBeenCalled();
  });
});
