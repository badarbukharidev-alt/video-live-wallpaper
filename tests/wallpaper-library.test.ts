import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_PREVIEW_PREFERENCES,
  inferWallpaperCategory,
  loadPreviewPreferences,
  loadWallpaperLibrary,
  saveWallpaperLibrary,
  WALLPAPER_LIBRARY_STORAGE_KEY,
  type WallpaperLibraryItem,
} from "../lib/wallpaper-library";

const libraryItem: WallpaperLibraryItem = {
  id: "ocean-1",
  uri: "file:///ocean.mp4",
  name: "Ocean sunset.mp4",
  mimeType: "video/mp4",
  selectedAt: "2026-08-18T00:00:00.000Z",
  category: "Nature",
  isFavorite: true,
};

describe("wallpaper library", () => {
  it("classifies helpful local-video categories from a file name", () => {
    expect(inferWallpaperCategory("Neon abstract.mp4")).toBe("Abstract");
    expect(inferWallpaperCategory("Night city.mp4")).toBe("City");
    expect(inferWallpaperCategory("Weekend clip.mp4")).toBe("Recent");
  });

  it("stores and restores valid local wallpaper items", async () => {
    const setItem = vi.fn().mockResolvedValue(undefined);
    await saveWallpaperLibrary({ getItem: vi.fn(), setItem }, [libraryItem]);
    expect(setItem).toHaveBeenCalledWith(WALLPAPER_LIBRARY_STORAGE_KEY, JSON.stringify([libraryItem]));

    await expect(
      loadWallpaperLibrary({ getItem: vi.fn().mockResolvedValue(JSON.stringify([libraryItem])), setItem }),
    ).resolves.toEqual([libraryItem]);
  });

  it("falls back to safe preview defaults when stored preferences are invalid", async () => {
    await expect(
      loadPreviewPreferences({ getItem: vi.fn().mockResolvedValue('{"muted":"yes"}'), setItem: vi.fn() }),
    ).resolves.toEqual(DEFAULT_PREVIEW_PREFERENCES);
  });
});
