import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { useEden } from "@/api/client";
import { useAuthStore } from "@/store/authStore";

const googleWebClientId =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ??
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ??
  "";

let isGoogleConfigured = false;

function ensureGoogleConfigured() {
  if (isGoogleConfigured) {
    return;
  }

  if (!googleWebClientId) {
    throw new Error(
      "Google sign-in is not configured. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in apps/mobile/.env."
    );
  }

  GoogleSignin.configure({
    webClientId: googleWebClientId,
  });
  isGoogleConfigured = true;
}

function toGoogleAuthError(error: unknown) {
  if (isErrorWithCode(error)) {
    switch (error.code) {
      case statusCodes.SIGN_IN_CANCELLED:
        return new Error("Google sign-in was cancelled.");
      case statusCodes.IN_PROGRESS:
        return new Error("Google sign-in is already in progress.");
      case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
        return new Error("Google Play Services is not available on this device.");
      default:
        break;
    }
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error("Unable to continue with Google right now.");
}

async function getGoogleIdToken() {
  ensureGoogleConfigured();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) {
    throw new Error("Google sign-in was cancelled.");
  }

  const idToken = response.data.idToken;
  if (!idToken) {
    throw new Error(
      "Google did not return an ID token. Make sure the mobile Google client ID matches the backend GOOGLE_CLIENT_ID."
    );
  }

  return idToken;
}

export function useGoogleAuth() {
  const eden = useEden();
  const router = useRouter();
  const login = useAuthStore((state) => state.login);

  const mutation = useMutation({
    ...eden.api.v1.auth.google.post.mutationOptions(),
  });

  const signIn = async () => {
    try {
      const idToken = await getGoogleIdToken();
      const data = await mutation.mutateAsync({ idToken });
      await login({
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
      router.replace("/(tabs)" as never);
    } catch (error) {
      throw toGoogleAuthError(error);
    }
  };

  return {
    signIn,
    isPending: mutation.isPending,
  };
}
