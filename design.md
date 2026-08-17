# Video Live Wallpaper — Interface Design

## Product Scope

Video Live Wallpaper is an Android-only utility for turning a device video into a real system live wallpaper. The first release is local-only: videos remain on the device, no account or cloud upload is required, and the app delegates final confirmation to Android’s own live-wallpaper settings screen.

> A development build is required for the real wallpaper action because the feature uses an Android `WallpaperService`; it cannot operate from Expo Go or the browser preview.

## Screen List

| Screen | Primary content and functionality | Layout for portrait, one-handed use |
|---|---|---|
| Home | Current selection summary, large video-preview area, recent selection, and an action to choose or replace a video. | A thumb-reachable primary button is anchored above the bottom navigation area; the video preview occupies the upper half of the screen. |
| Video Preview | Full-height looping preview, mute status, video name, and a single “Set live wallpaper” action. | The primary action spans the lower screen width, with a clear back action at the top left. |
| Android Wallpaper Confirmation | The operating system’s live-wallpaper confirmation page. The app supplies its registered wallpaper service and selected video. | This is an Android system-owned experience; the user selects the wallpaper target and confirms. |
| Help & Compatibility | Explains that supported video formats are device-dependent, wallpaper audio is muted, and a development build is necessary. | Brief, scannable instructions with a “Back to wallpaper” action. |

## Primary User Flow

The user opens the Home screen and taps **Choose video**. The system media picker returns a local video URI. The app stores the selected video locally, shows the looping preview, and enables **Set live wallpaper**. When tapped, the app hands the video to its Android wallpaper service and opens the Android system confirmation screen. The user completes Android’s confirmation step, after which the selected video plays as the device’s real live wallpaper.

## Data Model

| Entity | Fields | Local storage purpose |
|---|---|---|
| `WallpaperSelection` | `uri`, `name`, `mimeType`, `selectedAt` | Restores the latest selection in the app UI. |
| `WallpaperPreferences` | `muted`, `fitMode` | Provides an extensible location for future wallpaper preferences; the first release uses mute and cover fitting. |

The Android wallpaper service separately maintains the copied source video under the app’s private files directory. This prevents a transient picker URI from breaking after the app leaves the foreground.

## Color Choices

The visual language uses a deep night base to make video previews feel immersive: **Midnight Ink `#07121F`** is the screen background, **Aurora Cyan `#3DE1E6`** signals primary actions, **Electric Violet `#8B5CF6`** adds a secondary glow, and **Cloud `#EAF6FF`** provides high-contrast text. Supporting surfaces use **Blue Slate `#10283A`**, while successful readiness uses **Mint `#65E6B2`**. The palette stays legible in a dim room without imitating a generic neon interface.

## Interaction Principles

The app uses one decisive action per screen. Presses receive subtle opacity and haptic feedback. Video previews autoplay silently and loop, but no playback controls obstruct the visual. A short status label explains whether a video is selected, copied for wallpaper use, or waiting for the Android confirmation screen.
