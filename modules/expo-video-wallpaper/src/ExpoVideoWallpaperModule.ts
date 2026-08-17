import { requireOptionalNativeModule } from "expo";

import type { StoredWallpaperVideo } from "./ExpoVideoWallpaper.types";

export type VideoWallpaperModule = {
  isSupported(): boolean;
  storeVideoAsync(sourceUri: string, displayName?: string | null): Promise<StoredWallpaperVideo>;
  openWallpaperPreviewAsync(): Promise<{ opened: boolean }>;
  clearStoredVideoAsync(): Promise<void>;
};

const unsupportedModule: VideoWallpaperModule = {
  isSupported: () => false,
  storeVideoAsync: async () => {
    throw new Error("A custom Android development build is required to prepare a live wallpaper.");
  },
  openWallpaperPreviewAsync: async () => {
    throw new Error("A custom Android development build is required to apply a live wallpaper.");
  },
  clearStoredVideoAsync: async () => undefined,
};

export default (
  requireOptionalNativeModule<VideoWallpaperModule>("ExpoVideoWallpaper") ?? unsupportedModule
);
