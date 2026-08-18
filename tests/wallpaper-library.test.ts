import { describe, expect, it, vi } from "vitest";

import { REMOTE_WALLPAPER_CATALOG } from "../lib/wallpaper-catalog";

import {
  DEFAULT_PREVIEW_PREFERENCES,
  inferWallpaperCategory,
  loadActiveWallpaperId,
  mergeCatalogWithLibrary,
  saveActiveWallpaperId,
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

  it("keeps saved favorites and completed catalog downloads when catalog metadata is refreshed", () => {
    const catalogItem: WallpaperLibraryItem = { ...libraryItem, id: "catalog-01", uri: "https://example.com/video.m3u8", isFavorite: false, sourceKind: "catalog" };
    const savedFavorite = {
      ...catalogItem,
      downloadedAt: "2026-08-19T00:01:00.000Z",
      isDownloaded: true,
      isFavorite: true,
      selectedAt: "2026-08-19T00:00:00.000Z",
    };

    expect(mergeCatalogWithLibrary([catalogItem], [savedFavorite])).toEqual([savedFavorite]);
  });

  it("persists the active wallpaper identifier separately from the catalog order", async () => {
    const getItem = vi.fn().mockResolvedValue("catalog-04");
    const setItem = vi.fn().mockResolvedValue(undefined);

    await saveActiveWallpaperId({ getItem, setItem }, "catalog-04");
    await expect(loadActiveWallpaperId({ getItem, setItem })).resolves.toBe("catalog-04");
  });

  it("registers every supplied catalog wallpaper as a secure HLS video", () => {
    expect(REMOTE_WALLPAPER_CATALOG).toHaveLength(9);
    expect(REMOTE_WALLPAPER_CATALOG.every((item) => item.sourceKind === "catalog" && item.uri.startsWith("https://") && item.uri.endsWith(".m3u8"))).toBe(true);
  });
});
