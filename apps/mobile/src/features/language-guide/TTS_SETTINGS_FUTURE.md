# Future: Voice Not Available Flow

## Goal
Add a user flow for when a suitable native TTS voice is not available on device:
- Show a clear in-app message.
- Offer an action to open system TTS settings.
- Let the user retry voice detection/playback after returning.

## Why
Some devices/languages may not have a local voice pack installed.
`expo-speech` does not guarantee app-initiated voice-pack downloads.

## Proposed UX
1. User taps Play.
2. App checks available voices for selected language.
3. If no suitable voice:
   - Show: "Voice not available for this language."
   - Show action: "Open TTS settings"
4. User returns to app and taps "Retry".

## Platform Notes
- Android: best-effort deep-link to Text-to-Speech settings (OEM dependent).
- iOS: guide users to Settings where voices can be downloaded/managed.

## Implementation (Later)
- Add a helper to detect missing voice for the selected locale.
- Add UI state/message in language guide screen.
- Add platform-specific settings opener utility.
- Add graceful fallback if settings cannot be opened.

