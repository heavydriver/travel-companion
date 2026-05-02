import * as Sentry from "@sentry/react-native";

let initialized = false;

function sanitizeEvent(event: Sentry.Event): Sentry.Event | null {
  if (event.user) {
    event.user = {
      id: event.user.id,
    };
  }

  if (event.request?.headers) {
    delete event.request.headers.authorization;
  }

  return event;
}

export function initMonitoring() {
  if (initialized) return;

  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    enabled: Boolean(process.env.EXPO_PUBLIC_SENTRY_DSN),
    sendDefaultPii: false,
    beforeSend: sanitizeEvent,
  });

  initialized = true;
}

export function setMonitoringUser(userId?: string | null) {
  Sentry.setUser(userId ? { id: userId } : null);
}

export function setMonitoringScreen(pathname: string) {
  Sentry.setTag("screen_name", pathname);
}

export function captureMonitoringError(error: unknown) {
  Sentry.captureException(error);
}
