export const WALLPAPER_SELECTION_STORAGE_KEY = "video-live-wallpaper.selection.v1";

export type WallpaperSelection = {
  uri: string;
  name: string;
  mimeType: string | null;
  selectedAt: string;
};

type AsyncKeyValueStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

function isWallpaperSelection(value: unknown): value is WallpaperSelection {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<WallpaperSelection>;
  return (
    typeof candidate.uri === "string" &&
    typeof candidate.name === "string" &&
    (candidate.mimeType === null || typeof candidate.mimeType === "string") &&
    typeof candidate.selectedAt === "string"
  );
}

export async function loadWallpaperSelection(store: AsyncKeyValueStore): Promise<WallpaperSelection | null> {
  const raw = await store.getItem(WALLPAPER_SELECTION_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    return isWallpaperSelection(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveWallpaperSelection(
  store: AsyncKeyValueStore,
  selection: WallpaperSelection,
): Promise<void> {
  await store.setItem(WALLPAPER_SELECTION_STORAGE_KEY, JSON.stringify(selection));
}
