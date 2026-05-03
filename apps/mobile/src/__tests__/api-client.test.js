const mockLogin = jest.fn(async ({ user, accessToken, refreshToken }) => {
  mockAuthState.user = user;
  mockAuthState.accessToken = accessToken;
  if (refreshToken !== undefined) {
    mockAuthState.refreshToken = refreshToken ?? null;
  }
  mockAuthState.isAuthenticated = true;
});

const mockLogout = jest.fn(async () => {
  mockAuthState.user = null;
  mockAuthState.accessToken = null;
  mockAuthState.refreshToken = null;
  mockAuthState.isAuthenticated = false;
});

const mockAuthState = {
  user: {
    id: "user_123",
    email: "traveler@example.com",
    name: "Traveler",
    username: "traveler",
    avatarUrl: null,
    bio: null,
    socialOptIn: false,
  },
  accessToken: "",
  refreshToken: "refresh-token",
  isAuthenticated: true,
  isHydrated: true,
  login: mockLogin,
  logout: mockLogout,
  hydrateFromStorage: jest.fn(),
};

jest.mock("@/store/authStore", () => ({
  useAuthStore: {
    getState: () => mockAuthState,
  },
}));

jest.mock("@elysiajs/eden", () => ({
  treaty: jest.fn(() => ({})),
}));

jest.mock("eden-tanstack-react-query", () => ({
  createEdenTanStackQuery: jest.fn(() => ({
    EdenProvider: ({ children }) => children ?? null,
    useEden: jest.fn(),
    useEdenClient: jest.fn(),
  })),
}));

import { apiBaseUrl, createAuthAwareFetch } from "@/api/client";

function toBase64Url(value) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createToken(expiresInSeconds) {
  const header = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = toBase64Url(
    JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    })
  );
  return `${header}.${payload}.signature`;
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  };
}

describe("createAuthAwareFetch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState.user = {
      id: "user_123",
      email: "traveler@example.com",
      name: "Traveler",
      username: "traveler",
      avatarUrl: null,
      bio: null,
      socialOptIn: false,
    };
    mockAuthState.accessToken = createToken(60 * 10);
    mockAuthState.refreshToken = "refresh-token";
    mockAuthState.isAuthenticated = true;

    if (typeof global.atob !== "function") {
      global.atob = (value) => Buffer.from(value, "base64").toString("binary");
    }
  });

  it("refreshes an expired token before sending the protected request", async () => {
    const expiredToken = createToken(-60);
    const freshToken = createToken(60 * 15);
    mockAuthState.accessToken = expiredToken;

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { accessToken: freshToken }))
      .mockResolvedValueOnce(jsonResponse(200, { trips: [] }));

    global.fetch = fetchMock;

    const authFetch = createAuthAwareFetch();
    await authFetch(`${apiBaseUrl}/api/v1/trips`, {
      headers: {
        authorization: `Bearer ${expiredToken}`,
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `${apiBaseUrl}/api/v1/auth/refresh`,
      expect.objectContaining({
        method: "POST",
      })
    );

    const requestHeaders = fetchMock.mock.calls[1][1].headers;
    expect(requestHeaders.get("authorization")).toBe(`Bearer ${freshToken}`);
    expect(mockLogin).toHaveBeenCalledWith({
      user: mockAuthState.user,
      accessToken: freshToken,
      refreshToken: "refresh-token",
    });
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it("logs the user out when refresh is definitively rejected", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { message: "expired" }))
      .mockResolvedValueOnce(jsonResponse(401, { message: "invalid_refresh" }));

    global.fetch = fetchMock;

    const authFetch = createAuthAwareFetch();
    const response = await authFetch(`${apiBaseUrl}/api/v1/trips`);

    expect(response.status).toBe(401);
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it("keeps the user signed in when refresh fails transiently", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { message: "expired" }))
      .mockResolvedValueOnce(jsonResponse(500, { message: "temporary_failure" }));

    global.fetch = fetchMock;

    const authFetch = createAuthAwareFetch();
    const response = await authFetch(`${apiBaseUrl}/api/v1/trips`);

    expect(response.status).toBe(401);
    expect(mockLogout).not.toHaveBeenCalled();
  });
});
