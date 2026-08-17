import { describe, expect, it, vi } from "vitest";

import {
  loadWallpaperSelection,
  saveWallpaperSelection,
  WALLPAPER_SELECTION_STORAGE_KEY,
  type WallpaperSelection,
} from "../lib/wallpaper-selection";

const selection: WallpaperSelection = {
  uri: "file:///data/user/0/example/files/live_wallpaper/selected_video.mp4",
  name: "sunset.mp4",
  mimeType: "video/mp4",
  selectedAt: "2026-08-17T12:00:00.000Z",
};

describe("wallpaper selection persistence", () => {
  it("stores the selected local video under the fixed application key", async () => {
    const setItem = vi.fn().mockResolvedValue(undefined);
    await saveWallpaperSelection({ getItem: vi.fn(), setItem }, selection);

    expect(setItem).toHaveBeenCalledWith(
      WALLPAPER_SELECTION_STORAGE_KEY,
      JSON.stringify(selection),
    );
  });

  it("returns a valid saved selection and rejects malformed saved data", async () => {
    await expect(
      loadWallpaperSelection({
        getItem: vi.fn().mockResolvedValue(JSON.stringify(selection)),
        setItem: vi.fn(),
      }),
    ).resolves.toEqual(selection);

    await expect(
      loadWallpaperSelection({
        getItem: vi.fn().mockResolvedValue('{"uri":true}'),
        setItem: vi.fn(),
      }),
    ).resolves.toBeNull();
  });
});
