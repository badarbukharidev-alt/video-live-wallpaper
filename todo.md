# Project TODO

## Completed product work

- [x] Android-only video selection, portrait preview, and system live-wallpaper flow.
- [x] Local wallpaper-library and preference persistence.
- [x] Native Expo video-wallpaper module and Android WallpaperService.
- [x] Catalog HLS preview, safe-source guidance, download-before-apply flow, and offline-ready library state.
- [x] Editorial Explore, Library, Favorites, About, splash, launcher branding, and custom dock.
- [x] Managed preview stabilization with persistent exported web preview server.
- [x] Automated tests, TypeScript, and lint validation for the application layer.

## Known historical items

- [ ] Confirm a hosted Android release build compiles the repaired Kotlin source; the sandbox has no Android SDK and hosted Gradle plugin resolution is required.
- [ ] Evaluate bundling actual local MP4 Explore assets from licensed/source files; the second user attachment is a separate architecture request and is not implemented without actual MP4 assets and hosted APK verification.

## Current Android build-repair request

- [x] Read pasted_content.txt and pasted_content_2.txt.
- [x] Identify the root cause: `downloadAndAwait(...)` was called from a plain non-suspending Expo `AsyncFunction`.
- [x] Fix `modules/expo-video-wallpaper/android/src/main/java/expo/modules/videowallpaper/ExpoVideoWallpaperModule.kt` with Expo’s lifecycle-aware `AsyncFunction(...) Coroutine { ... }` DSL.
- [x] Preserve the existing JavaScript API and avoid `runBlocking` or UI-thread blocking.
- [x] Regenerate the Android project with `npx expo prebuild --platform android --no-install`.
- [x] Run `pnpm test`: 8 passed, 1 skipped.
- [x] Run `pnpm check`: passed.
- [x] Run `pnpm lint`: passed with a non-blocking module-type warning.
- [x] Confirm the reported “can only be called from a coroutine” message is absent from source and logs.
- [x] Attempt local native validation and record the sandbox blocker: Gradle cannot resolve `org.gradle.toolchains.foojay-resolver-convention:0.5.0` offline, and the environment lacks a usable Android SDK.
- [ ] Run the hosted Android release build to confirm Kotlin compilation and APK/AAB packaging.
- [ ] Save a checkpoint for the corrected build-ready source.

## Delivery checklist

- [ ] Read this checklist before checkpointing.
- [ ] Save the corrected checkpoint.
- [ ] Report the exact changed file, root cause, coroutine fix, commands, validation results, and remaining hosted-build status.

## Preserved task history

The oversized repetitive checklist generated during the interrupted session is preserved verbatim in `todo.history.md`; it is retained for audit history and is not the active checklist.

## Build repair handoff

- [x] The reproducible Kotlin source error is corrected.
- [x] The project is ready for the next hosted Android build attempt.
- [ ] Final native release success remains unconfirmed until the hosted build completes.
- [ ] Checkpoint and user report remain pending.

## Current request finalization

- [x] Error reports analyzed.
- [x] Source fix applied.
- [x] Application validation completed.
- [ ] Save checkpoint and deliver final report.

## Current build-ready state

- [x] Exact file, root cause, fix, and command outcomes prepared.
- [ ] Save corrected checkpoint.
- [ ] Deliver final report.

## Current task closeout

- [x] Correct errors ready build.
- [ ] Checkpoint pending.
- [ ] Final report pending.
