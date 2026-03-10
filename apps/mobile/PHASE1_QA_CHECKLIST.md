# Phase 1 Mobile QA Checklist

## Devices

- iOS simulator (latest Expo SDK target)
- Android emulator (latest Expo SDK target)

## First-run and onboarding

- Fresh install opens onboarding instead of auth screens.
- Onboarding renders 5 slides with title, subtitle, and image placeholder.
- `Next` advances through slides and final button changes to `Get started`.
- `Skip intro` navigates to Login.
- Tapping `Login` or `Create account` on any slide marks onboarding as seen and routes to the selected auth screen.

## Auth flows (backend connected)

- Register validates name, username, email, and password before submit.
- Register success stores auth state in Zustand + Async Storage and routes to Home tab.
- Login validates email/password and shows generic error on failed auth.
- Login success stores auth state and routes to Home tab.
- App relaunch with stored auth state opens tabs directly.
- App relaunch without auth but onboarding seen opens Login directly.

## Tab navigation

- Custom bottom tab bar is visible with 5 tabs: Home, Map, Explore, Assistant, Itinerary.
- Home and Explore icons render from image assets.
- All tabs are pressable and switch to their route.
- Active tab has distinct visual state.

## Home screen shell

- Home greeting uses authenticated user name when available.
- Home shows placeholder upcoming trips card and CTA buttons.
- Sign out clears auth state and routes to Login.

## Theming and feedback

- Light mode and dark mode both display readable contrast on onboarding, auth, and home.
- Loading indicators appear during login/register submission.
- Error banner appears on failed login/register responses.
