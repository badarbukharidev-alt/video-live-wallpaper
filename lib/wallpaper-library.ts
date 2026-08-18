import type { WallpaperSelection } from "./wallpaper-selection";

export const WALLPAPER_LIBRARY_STORAGE_KEY = "video-live-wallpaper.library.v1";
export const WALLPAPER_PREVIEW_PREFERENCES_STORAGE_KEY =
  "video-live-wallpaper.preview-preferences.v1";
export const WALLPAPER_ACTIVE_ID_STORAGE_KEY = "video-live-wallpaper.active-id.v1";

export type WallpaperCategory = "Recent" | "Nature" | "Abstract" | "City" | "Calm";
export type WallpaperSourceKind = "local" | "catalog";

export type WallpaperLibraryItem = WallpaperSelection & {
  id: string;
  category: WallpaperCategory;
  isFavorite: boolean;
  sourceKind?: WallpaperSourceKind;
  isDownloaded?: boolean;
  downloadedAt?: string;
};

export type PreviewPreferences = {
  fitMode: "cover" | "contain";
  muted: boolean;
};

type AsyncKeyValueStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

export const DEFAULT_PREVIEW_PREFERENCES: PreviewPreferences = {
  fitMode: "cover",
  muted: true,
};

function isLibraryItem(value: unknown): value is WallpaperLibraryItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<WallpaperLibraryItem>;
  return (
    typeof item.id === "string" &&
    typeof item.uri === "string" &&
    typeof item.name === "string" &&
    typeof item.selectedAt === "string" &&
    typeof item.isFavorite === "boolean" &&
    (item.isDownloaded === undefined || typeof item.isDownloaded === "boolean") &&
    (item.downloadedAt === undefined || typeof item.downloadedAt === "string") &&
    ["Recent", "Nature", "Abstract", "City", "Calm"].includes(item.category ?? "")
  );
}

function isPreviewPreferences(value: unknown): value is PreviewPreferences {
  if (!value || typeof value !== "object") return false;
  const preferences = value as Partial<PreviewPreferences>;
  return (
    (preferences.fitMode === "cover" || preferences.fitMode === "contain") &&
    typeof preferences.muted === "boolean"
  );
}

export function inferWallpaperCategory(name: string): WallpaperCategory {
  const label = name.toLowerCase();
  if (/(forest|ocean|beach|sunset|mountain|nature|flower|sky|rain)/.test(label)) return "Nature";
  if (/(neon|abstract|color|art|shape|glow)/.test(label)) return "Abstract";
  if (/(city|street|night|building|urban)/.test(label)) return "City";
  if (/(calm|soft|cloud|mist|lake|sleep)/.test(label)) return "Calm";
  return "Recent";
}

export function isCatalogWallpaper(item: WallpaperLibraryItem) {
  return item.sourceKind === "catalog" || item.uri.startsWith("https://");
}

export function mergeCatalogWithLibrary(
  catalog: WallpaperLibraryItem[],
  savedLibrary: WallpaperLibraryItem[],
): WallpaperLibraryItem[] {
  const savedById = new Map(savedLibrary.map((item) => [item.id, item]));
  const mergedCatalog = catalog.map((item) => {
    const saved = savedById.get(item.id);
    return saved
      ? {
          ...item,
          downloadedAt: saved.downloadedAt,
          isDownloaded: saved.isDownloaded,
          isFavorite: saved.isFavorite,
          selectedAt: saved.selectedAt,
        }
      : item;
  });
  const localItems = savedLibrary.filter((item) => !catalog.some((catalogItem) => catalogItem.id === item.id));
  return [...localItems, ...mergedCatalog];
}

export async function loadWallpaperLibrary(store: AsyncKeyValueStore): Promise<WallpaperLibraryItem[]> {
  const raw = await store.getItem(WALLPAPER_LIBRARY_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isLibraryItem) : [];
  } catch {
    return [];
  }
}

export async function saveWallpaperLibrary(
  store: AsyncKeyValueStore,
  library: WallpaperLibraryItem[],
): Promise<void> {
  await store.setItem(WALLPAPER_LIBRARY_STORAGE_KEY, JSON.stringify(library));
}

export async function loadPreviewPreferences(store: AsyncKeyValueStore): Promise<PreviewPreferences> {
  const raw = await store.getItem(WALLPAPER_PREVIEW_PREFERENCES_STORAGE_KEY);
  if (!raw) return DEFAULT_PREVIEW_PREFERENCES;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isPreviewPreferences(parsed) ? parsed : DEFAULT_PREVIEW_PREFERENCES;
  } catch {
    return DEFAULT_PREVIEW_PREFERENCES;
  }
}

export async function savePreviewPreferences(
  store: AsyncKeyValueStore,
  preferences: PreviewPreferences,
): Promise<void> {
  await store.setItem(WALLPAPER_PREVIEW_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
}

export async function loadActiveWallpaperId(store: AsyncKeyValueStore): Promise<string | null> {
  return store.getItem(WALLPAPER_ACTIVE_ID_STORAGE_KEY);
}

export async function saveActiveWallpaperId(
  store: AsyncKeyValueStore,
  wallpaperId: string,
): Promise<void> {
  await store.setItem(WALLPAPER_ACTIVE_ID_STORAGE_KEY, wallpaperId);
}
