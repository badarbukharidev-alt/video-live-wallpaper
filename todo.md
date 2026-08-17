# Project TODO

- [x] Create the Android-only video selection, preview, and apply-wallpaper interface.
- [x] Add local persistence for the latest selected video and wallpaper preferences.
- [x] Add an Android native wallpaper service that plays a selected local video on the system wallpaper surface.
- [x] Add a native Android bridge that copies the chosen video privately and opens the system live-wallpaper confirmation flow.
- [x] Generate a custom Video Live Wallpaper launcher icon and apply it to all required mobile branding assets.
- [x] Configure Android manifest and native build files for the live-wallpaper service.
- [x] Add automated tests for local selection state and platform-safe wallpaper actions.
- [x] Run TypeScript, lint, and test validation; review Android native integration for build readiness.
- [ ] Retry Android Gradle compilation when plugins.gradle.org is reachable; two compilation attempts stopped while downloading a third-party build plugin.
