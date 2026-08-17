import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { VideoView, useVideoPlayer } from "expo-video";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import { CatalogVideoPreview } from "@/components/catalog-video-preview";
import { ScreenContainer } from "@/components/screen-container";
import { REMOTE_WALLPAPER_CATALOG } from "@/lib/wallpaper-catalog";
import {
  DEFAULT_PREVIEW_PREFERENCES,
  inferWallpaperCategory,
  isCatalogWallpaper,
  loadActiveWallpaperId,
  loadPreviewPreferences,
  loadWallpaperLibrary,
  mergeCatalogWithLibrary,
  saveActiveWallpaperId,
  savePreviewPreferences,
  saveWallpaperLibrary,
  type PreviewPreferences,
  type WallpaperCategory,
  type WallpaperLibraryItem,
} from "@/lib/wallpaper-library";
import {
  loadWallpaperSelection,
  saveWallpaperSelection,
  type WallpaperSelection,
} from "@/lib/wallpaper-selection";
import ExpoVideoWallpaperModule from "@/modules/expo-video-wallpaper/src/ExpoVideoWallpaperModule";

type GalleryFilter = "All" | "Favorites" | WallpaperCategory;
type HomeTab = "Explore" | "Library" | "Favorites";

const FILTERS: GalleryFilter[] = ["All", "Favorites", "Nature", "Abstract", "City", "Calm"];

function isMatchingFilter(item: WallpaperLibraryItem, filter: GalleryFilter) {
  if (filter === "All") return true;
  if (filter === "Favorites") return item.isFavorite;
  return item.category === filter;
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : "The Android wallpaper service could not open this video.";
}

export default function WallpaperHomeScreen() {
  const [selection, setSelection] = useState<WallpaperSelection | null>(null);
  const [library, setLibrary] = useState<WallpaperLibraryItem[]>([]);
  const [preferences, setPreferences] = useState<PreviewPreferences>(DEFAULT_PREVIEW_PREFERENCES);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<GalleryFilter>("All");
  const [activeTab, setActiveTab] = useState<HomeTab>("Explore");
  const [isReady, setIsReady] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [operation, setOperation] = useState<"selecting" | "applying" | "downloading" | null>(null);

  const player = useVideoPlayer(selection?.uri ?? REMOTE_WALLPAPER_CATALOG[0].uri, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = true;
    videoPlayer.play();
  });
  const canApplyWallpaper = Platform.OS === "android" && ExpoVideoWallpaperModule.isSupported();

  const selectedItem = useMemo(
    () => library.find((item) => item.uri === selection?.uri) ?? null,
    [library, selection?.uri],
  );
  const activeItem = useMemo(
    () => library.find((item) => item.id === activeId) ?? selectedItem ?? REMOTE_WALLPAPER_CATALOG[0],
    [activeId, library, selectedItem],
  );
  const cardItems = useMemo(() => {
    if (activeTab === "Favorites") return library.filter((item) => item.isFavorite);
    const filtered = library.filter((item) => isMatchingFilter(item, activeFilter));
    if (activeTab === "Library") return filtered.filter((item) => !isCatalogWallpaper(item));
    return filtered.filter(isCatalogWallpaper);
  }, [activeFilter, activeTab, library]);

  const persistLibrary = useCallback(async (nextLibrary: WallpaperLibraryItem[]) => {
    setLibrary(nextLibrary);
    await saveWallpaperLibrary(AsyncStorage, nextLibrary);
  }, []);

  const persistSelection = useCallback(async (item: WallpaperLibraryItem) => {
    const nextSelection: WallpaperSelection = {
      uri: item.uri,
      name: item.name,
      mimeType: item.mimeType,
      selectedAt: new Date().toISOString(),
    };
    setSelection(nextSelection);
    await saveWallpaperSelection(AsyncStorage, nextSelection);
  }, []);

  useEffect(() => {
    const hydrate = async () => {
      const [savedSelection, savedLibrary, savedPreferences, savedActiveId] = await Promise.all([
        loadWallpaperSelection(AsyncStorage),
        loadWallpaperLibrary(AsyncStorage),
        loadPreviewPreferences(AsyncStorage),
        loadActiveWallpaperId(AsyncStorage),
      ]);
      const mergedLibrary = mergeCatalogWithLibrary(REMOTE_WALLPAPER_CATALOG, savedLibrary);
      const restoredActive = mergedLibrary.find((item) => item.id === savedActiveId);
      setLibrary(mergedLibrary);
      setPreferences(savedPreferences);
      setActiveId(restoredActive?.id ?? null);
      setSelection(savedSelection ?? (restoredActive ? {
        uri: restoredActive.uri,
        name: restoredActive.name,
        mimeType: restoredActive.mimeType,
        selectedAt: restoredActive.selectedAt,
      } : null));
      setIsReady(true);
    };
    void hydrate();
  }, []);

  useEffect(() => {
    player.muted = preferences.muted;
    player.play();
  }, [player, preferences.muted, selection?.uri]);

  const chooseVideo = useCallback(async () => {
    setOperation("selecting");
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["videos"], allowsMultipleSelection: false, quality: 1 });
      if (result.canceled) return;
      const video = result.assets[0];
      const initialSelection: WallpaperSelection = {
        uri: video.uri,
        name: video.fileName ?? "Untitled motion",
        mimeType: video.mimeType ?? null,
        selectedAt: new Date().toISOString(),
      };
      const stored = canApplyWallpaper
        ? await ExpoVideoWallpaperModule.storeVideoAsync(initialSelection.uri, initialSelection.name)
        : initialSelection;
      const item: WallpaperLibraryItem = {
        ...initialSelection,
        id: stored.uri,
        uri: stored.uri,
        name: stored.name,
        category: inferWallpaperCategory(stored.name),
        isFavorite: false,
        sourceKind: "local",
      };
      const nextLibrary = [item, ...library.filter((existing) => existing.id !== item.id)];
      await Promise.all([persistLibrary(nextLibrary), persistSelection(item)]);
      setActiveTab("Library");
      setIsDetailOpen(true);
      if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      Alert.alert("Video unavailable", errorMessage(error));
    } finally {
      setOperation(null);
    }
  }, [canApplyWallpaper, library, persistLibrary, persistSelection]);

  const openItem = useCallback(async (item: WallpaperLibraryItem) => {
    await persistSelection(item);
    setIsDetailOpen(true);
  }, [persistSelection]);

  const toggleFavorite = useCallback(async (item: WallpaperLibraryItem) => {
    const nextLibrary = library.map((existing) => existing.id === item.id ? { ...existing, isFavorite: !existing.isFavorite } : existing);
    await persistLibrary(nextLibrary);
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [library, persistLibrary]);

  const applyWallpaper = useCallback(async () => {
    if (!selectedItem || !selection) return;
    if (!canApplyWallpaper) {
      Alert.alert("Android development build required", "Rebuild and install the Android development build to activate the native live wallpaper service.");
      return;
    }
    setOperation(selectedItem.sourceKind === "catalog" ? "downloading" : "applying");
    try {
      if (selectedItem.sourceKind === "catalog") {
        await ExpoVideoWallpaperModule.downloadCatalogVideoAsync(selection.uri, selection.name);
      }
      await ExpoVideoWallpaperModule.setActiveVideoAsync(selection.uri, selection.name);
      await ExpoVideoWallpaperModule.openWallpaperPreviewAsync();
      await saveActiveWallpaperId(AsyncStorage, selectedItem.id);
      setActiveId(selectedItem.id);
      if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert(
        "Could not open Android wallpaper",
        `${errorMessage(error)}\n\nIf you updated this project, rebuild the Android development app before retrying.`,
      );
    } finally {
      setOperation(null);
    }
  }, [canApplyWallpaper, selectedItem, selection]);

  const updatePreferences = useCallback(async (nextPreferences: PreviewPreferences) => {
    setPreferences(nextPreferences);
    await savePreviewPreferences(AsyncStorage, nextPreferences);
  }, []);

  const renderWallpaperCard = useCallback(({ item }: { item: WallpaperLibraryItem }) => (
    <Pressable onPress={() => void openItem(item)} style={({ pressed }) => [styles.wallpaperCard, pressed && styles.pressed]}>
      <View style={styles.cardPreview}>
        {isCatalogWallpaper(item) ? <CatalogVideoPreview uri={item.uri} /> : <LocalVideoPreview uri={item.uri} />}
        {item.id === activeId ? <View style={styles.activePill}><View style={styles.activeDot} /><Text style={styles.activePillText}>ACTIVE</Text></View> : null}
        <View style={styles.cardPlay}><MaterialIcons color="#FFFFFF" name="play-arrow" size={19} /></View>
      </View>
      <View style={styles.cardFooter}>
        <View style={styles.cardText}><Text numberOfLines={1} style={styles.cardTitle}>{item.name}</Text><Text style={styles.cardMeta}>{item.sourceKind === "catalog" ? "Catalog video" : "Device video"}</Text></View>
        <Pressable hitSlop={8} onPress={() => void toggleFavorite(item)} style={styles.cardHeart}>
          <MaterialIcons color={item.isFavorite ? "#E34B59" : "#797E91"} name={item.isFavorite ? "favorite" : "favorite-border"} size={20} />
        </Pressable>
      </View>
    </Pressable>
  ), [activeId, openItem, toggleFavorite]);

  const sectionTitle = activeTab === "Explore" ? "Playable wallpaper catalog" : activeTab === "Library" ? "Your device videos" : "All favorites";

  return (
    <ScreenContainer className="px-0" containerClassName="bg-background">
      <StatusBar style="dark" />
      <View style={styles.page}>
        <FlatList
          columnWrapperStyle={cardItems.length > 0 ? styles.gridRow : undefined}
          contentContainerStyle={styles.listContent}
          data={cardItems}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<EmptyState tab={activeTab} onChoose={() => void chooseVideo()} />}
          ListFooterComponent={<View style={styles.infoCard}><View style={styles.infoIcon}><MaterialIcons color="#3657D7" name="info-outline" size={20} /></View><View style={styles.infoCopy}><Text style={styles.infoTitle}>Catalog videos play from their source</Text><Text style={styles.infoText}>For guaranteed offline wallpaper playback, choose a video saved on your device.</Text></View></View>}
          ListHeaderComponent={<View style={styles.headerContent}>
            <View style={styles.header}><View><Text style={styles.kicker}>VIDEO LIVE WALLPAPER</Text><Text style={styles.brand}>Explore</Text></View><Pressable onPress={() => void chooseVideo()} style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}>{operation === "selecting" ? <ActivityIndicator color="#3657D7" /> : <MaterialIcons color="#252A45" name="add" size={24} />}</Pressable></View>
            <Pressable onPress={() => void chooseVideo()} style={({ pressed }) => [styles.searchBar, pressed && styles.pressed]}><MaterialIcons color="#5F6480" name="video-library" size={20} /><Text style={styles.searchText}>Choose a video from your device</Text><MaterialIcons color="#3657D7" name="arrow-forward" size={19} /></Pressable>
            <FlatList contentContainerStyle={styles.chipRow} data={FILTERS} horizontal keyExtractor={(filter) => filter} renderItem={({ item: filter }) => <Pressable onPress={() => setActiveFilter(filter)} style={({ pressed }) => [styles.chip, activeFilter === filter && styles.chipActive, pressed && styles.pressed]}><Text style={[styles.chipLabel, activeFilter === filter && styles.chipLabelActive]}>{filter}</Text></Pressable>} showsHorizontalScrollIndicator={false} />
            <Text style={styles.sectionEyebrow}>{activeId ? "YOUR ACTIVE WALLPAPER" : "FEATURED WALLPAPER"}</Text>
            <Pressable onPress={() => void openItem(activeItem)} style={({ pressed }) => [styles.heroCard, pressed && styles.pressed]}>
              <VideoView contentFit="cover" nativeControls={false} player={player} style={styles.heroVideo} surfaceType="textureView" />
              <View style={styles.heroShade} />
              <View style={styles.heroMeta}><View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveBadgeText}>{activeId ? "ACTIVE WALL" : "CATALOG PREVIEW"}</Text></View><View style={styles.heroFooter}><View style={styles.heroCopy}><Text numberOfLines={1} style={styles.heroTitle}>{activeItem.name}</Text><Text style={styles.heroSubtitle}>{activeItem.category} · {activeId ? "Ready on Android" : "Tap to add to wallpaper"}</Text></View><Pressable onPress={() => void toggleFavorite(activeItem)} style={styles.favoriteCircle}><MaterialIcons color="#FFFFFF" name={activeItem.isFavorite ? "favorite" : "favorite-border"} size={22} /></Pressable></View></View>
            </Pressable>
            <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{sectionTitle}</Text><Text style={styles.sectionCount}>{cardItems.length} videos</Text></View>
          </View>}
          numColumns={2}
          renderItem={renderWallpaperCard}
          showsVerticalScrollIndicator={false}
        />
        <View style={styles.bottomDock}>
          {([ ["Explore", "explore"], ["Library", "video-library"], ["Favorites", "favorite-border"] ] as const).map(([label, icon]) => <Pressable key={label} onPress={() => setActiveTab(label)} style={({ pressed }) => [styles.dockItem, pressed && styles.pressed]}><MaterialIcons color={activeTab === label ? "#3657D7" : "#9094A4"} name={icon} size={23} /><Text style={[styles.dockLabel, activeTab === label && styles.dockLabelActive]}>{label}</Text></Pressable>)}
          <Pressable onPress={() => router.push("/about" as never)} style={({ pressed }) => [styles.dockItem, pressed && styles.pressed]}><MaterialIcons color="#9094A4" name="info-outline" size={23} /><Text style={styles.dockLabel}>About</Text></Pressable>
        </View>
      </View>
      <Modal animationType="slide" onRequestClose={() => setIsDetailOpen(false)} transparent visible={isDetailOpen}>
        <View style={styles.modalBackdrop}><Pressable onPress={() => setIsDetailOpen(false)} style={StyleSheet.absoluteFill} /><View style={styles.detailSheet}><View style={styles.sheetHandle} /><View style={styles.detailHeader}><View style={styles.detailThumb}><MaterialIcons color="#3657D7" name={selectedItem?.sourceKind === "catalog" ? "cloud-download" : "movie-filter"} size={26} /></View><View style={styles.detailHeaderCopy}><Text numberOfLines={1} style={styles.detailTitle}>{selectedItem?.name ?? "Choose a video"}</Text><Text style={styles.detailSubtitle}>{selectedItem?.sourceKind === "catalog" ? "Catalog preview · Streams to Android" : "Saved device video · Offline ready"}</Text></View>{selectedItem ? <Pressable onPress={() => void toggleFavorite(selectedItem)} style={styles.iconButton}><MaterialIcons color={selectedItem.isFavorite ? "#E34B59" : "#3D4259"} name={selectedItem.isFavorite ? "favorite" : "favorite-border"} size={24} /></Pressable> : null}</View>
          <View style={styles.settingsBlock}><Text style={styles.settingsLabel}>PREVIEW SETTINGS</Text><View style={styles.settingRow}><View><Text style={styles.settingTitle}>Video fit</Text><Text style={styles.settingText}>Fill the phone screen or keep the full frame.</Text></View><View style={styles.segmentedControl}>{(["cover", "contain"] as const).map((fitMode) => <Pressable key={fitMode} onPress={() => void updatePreferences({ ...preferences, fitMode })} style={[styles.segment, preferences.fitMode === fitMode && styles.segmentActive]}><Text style={[styles.segmentText, preferences.fitMode === fitMode && styles.segmentTextActive]}>{fitMode === "cover" ? "Fill" : "Fit"}</Text></Pressable>)}</View></View><View style={[styles.settingRow, styles.settingRowBorder]}><View><Text style={styles.settingTitle}>Mute preview</Text><Text style={styles.settingText}>Live wallpaper audio always stays muted.</Text></View><Switch onValueChange={(muted) => void updatePreferences({ ...preferences, muted })} thumbColor="#FFFFFF" trackColor={{ false: "#C7CAD6", true: "#3657D7" }} value={preferences.muted} /></View></View>
          <Pressable disabled={!selectedItem || !isReady || operation !== null} onPress={() => void applyWallpaper()} style={({ pressed }) => [styles.applyButton, (!selectedItem || !isReady || operation !== null) && styles.applyButtonDisabled, pressed && styles.pressed]}>{operation === "applying" || operation === "downloading" ? <ActivityIndicator color="#FFFFFF" /> : <MaterialIcons color="#FFFFFF" name="wallpaper" size={21} />}<Text style={styles.applyButtonText}>{selectedItem?.sourceKind === "catalog" ? "Download & set wallpaper" : "Set live wallpaper"}</Text></Pressable><Text style={styles.systemNote}>{selectedItem?.sourceKind === "catalog" ? "Catalog video caches on-device while Android opens the final confirmation." : "Android opens its final confirmation screen next."}</Text>
        </View></View>
      </Modal>
    </ScreenContainer>
  );
}

function LocalVideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (videoPlayer) => { videoPlayer.loop = true; videoPlayer.muted = true; videoPlayer.play(); });
  return <VideoView contentFit="cover" nativeControls={false} player={player} style={styles.previewVideo} surfaceType="textureView" />;
}

function EmptyState({ tab, onChoose }: { tab: HomeTab; onChoose: () => void }) {
  const copy = tab === "Favorites" ? "Tap the heart on any catalog or device video to keep it here." : tab === "Library" ? "Choose a video from your device to create an offline-ready wallpaper." : "No catalog videos match this filter yet.";
  return <View style={styles.emptyLibrary}><MaterialIcons color="#7581D7" name={tab === "Favorites" ? "favorite-border" : "video-library"} size={28} /><Text style={styles.emptyLibraryTitle}>{tab === "Favorites" ? "No favorites yet" : "Nothing to show"}</Text><Text style={styles.emptyLibraryCopy}>{copy}</Text>{tab !== "Explore" ? <Pressable onPress={onChoose} style={styles.emptyAction}><Text style={styles.emptyActionText}>Choose a video</Text></Pressable> : null}</View>;
}

const styles = StyleSheet.create({
  page: { backgroundColor: "#F7F7FB", flex: 1 },
  listContent: { paddingBottom: 118, paddingHorizontal: 20, paddingTop: 14 },
  headerContent: { gap: 18, paddingBottom: 18 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  kicker: { color: "#6D7190", fontSize: 10, fontWeight: "800", letterSpacing: 1.15 }, brand: { color: "#151622", fontSize: 31, fontWeight: "800", letterSpacing: -1.2, marginTop: 1 },
  headerAction: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E5E6ED", borderRadius: 18, borderWidth: 1, height: 46, justifyContent: "center", width: 46 },
  searchBar: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E7E8EF", borderRadius: 17, borderWidth: 1, flexDirection: "row", gap: 11, minHeight: 54, paddingHorizontal: 15 }, searchText: { color: "#787C8C", flex: 1, fontSize: 14, fontWeight: "600" },
  chipRow: { gap: 8, paddingRight: 20 }, chip: { backgroundColor: "#ECECF3", borderRadius: 999, paddingHorizontal: 15, paddingVertical: 9 }, chipActive: { backgroundColor: "#1D1F2B" }, chipLabel: { color: "#565A6A", fontSize: 13, fontWeight: "700" }, chipLabelActive: { color: "#FFFFFF" },
  sectionEyebrow: { color: "#6D7190", fontSize: 10, fontWeight: "800", letterSpacing: 1.1 }, heroCard: { aspectRatio: 0.69, backgroundColor: "#2A2D44", borderRadius: 27, overflow: "hidden", position: "relative" }, heroVideo: { height: "100%", width: "100%" }, heroShade: { backgroundColor: "rgba(0,0,0,0.35)", bottom: 0, height: "48%", left: 0, position: "absolute", right: 0 }, heroMeta: { bottom: 17, left: 17, position: "absolute", right: 17 }, liveBadge: { alignItems: "center", alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.22)", borderColor: "rgba(255,255,255,0.36)", borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 10, paddingVertical: 6 }, liveDot: { backgroundColor: "#80FFD5", borderRadius: 4, height: 7, width: 7 }, liveBadgeText: { color: "#FFFFFF", fontSize: 9, fontWeight: "800", letterSpacing: 0.8 }, heroFooter: { alignItems: "flex-end", flexDirection: "row", justifyContent: "space-between", marginTop: 13 }, heroCopy: { flex: 1, paddingRight: 12 }, heroTitle: { color: "#FFFFFF", fontSize: 21, fontWeight: "800", letterSpacing: -0.5 }, heroSubtitle: { color: "#F2F3FF", fontSize: 12, fontWeight: "600", marginTop: 3 }, favoriteCircle: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.18)", borderColor: "rgba(255,255,255,0.35)", borderRadius: 17, borderWidth: 1, height: 40, justifyContent: "center", width: 40 },
  sectionHeading: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" }, sectionTitle: { color: "#171824", fontSize: 19, fontWeight: "800", letterSpacing: -0.35 }, sectionCount: { color: "#6F7485", fontSize: 12, fontWeight: "700" },
  gridRow: { gap: 12, justifyContent: "space-between", marginBottom: 12 }, wallpaperCard: { backgroundColor: "#FFFFFF", borderColor: "#EAEBF0", borderRadius: 19, borderWidth: 1, flex: 1, maxWidth: "48.2%", overflow: "hidden" }, cardPreview: { aspectRatio: 0.64, backgroundColor: "#26293B", overflow: "hidden", position: "relative" }, previewVideo: { height: "100%", width: "100%" }, cardPlay: { alignItems: "center", backgroundColor: "rgba(16,18,32,0.53)", borderRadius: 18, bottom: 9, height: 36, justifyContent: "center", right: 9, position: "absolute", width: 36 }, activePill: { alignItems: "center", backgroundColor: "#1A1B27", borderRadius: 999, flexDirection: "row", gap: 5, left: 8, paddingHorizontal: 8, paddingVertical: 5, position: "absolute", top: 8 }, activeDot: { backgroundColor: "#72E5BA", borderRadius: 4, height: 7, width: 7 }, activePillText: { color: "#FFFFFF", fontSize: 8, fontWeight: "800", letterSpacing: 0.5 }, cardFooter: { alignItems: "center", flexDirection: "row", gap: 4, minHeight: 56, paddingHorizontal: 10 }, cardText: { flex: 1 }, cardTitle: { color: "#323543", fontSize: 12, fontWeight: "800" }, cardMeta: { color: "#898D9B", fontSize: 10, fontWeight: "600", marginTop: 2 }, cardHeart: { padding: 4 },
  emptyLibrary: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E7E8EF", borderRadius: 20, borderStyle: "dashed", borderWidth: 1, gap: 8, minHeight: 175, justifyContent: "center", marginBottom: 18, paddingHorizontal: 30 }, emptyLibraryTitle: { color: "#2A2D3B", fontSize: 15, fontWeight: "800" }, emptyLibraryCopy: { color: "#777B8D", fontSize: 13, lineHeight: 19, textAlign: "center" }, emptyAction: { backgroundColor: "#E8EBFF", borderRadius: 12, marginTop: 4, paddingHorizontal: 14, paddingVertical: 9 }, emptyActionText: { color: "#3657D7", fontSize: 12, fontWeight: "800" },
  infoCard: { alignItems: "flex-start", backgroundColor: "#E8EBFF", borderRadius: 19, flexDirection: "row", gap: 12, marginTop: 6, padding: 15 }, infoIcon: { alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 12, height: 38, justifyContent: "center", width: 38 }, infoCopy: { flex: 1, gap: 3 }, infoTitle: { color: "#2E3976", fontSize: 14, fontWeight: "800" }, infoText: { color: "#59618B", fontSize: 12, lineHeight: 18 },
  bottomDock: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.98)", borderColor: "#E5E6ED", borderRadius: 24, borderWidth: 1, bottom: 13, flexDirection: "row", justifyContent: "space-around", left: 16, paddingVertical: 10, position: "absolute", right: 16 }, dockItem: { alignItems: "center", gap: 3, minWidth: 54 }, dockLabel: { color: "#9094A4", fontSize: 9, fontWeight: "700" }, dockLabelActive: { color: "#3657D7" },
  modalBackdrop: { backgroundColor: "rgba(21,22,34,0.34)", flex: 1, justifyContent: "flex-end" }, detailSheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingBottom: 32, paddingHorizontal: 21, paddingTop: 12 }, sheetHandle: { alignSelf: "center", backgroundColor: "#D8DAE3", borderRadius: 99, height: 4, marginBottom: 18, width: 44 }, detailHeader: { alignItems: "center", flexDirection: "row", gap: 11, marginBottom: 20 }, detailThumb: { alignItems: "center", backgroundColor: "#E8EBFF", borderRadius: 15, height: 53, justifyContent: "center", width: 53 }, detailHeaderCopy: { flex: 1 }, detailTitle: { color: "#191A27", fontSize: 17, fontWeight: "800" }, detailSubtitle: { color: "#777B8D", fontSize: 12, fontWeight: "600", marginTop: 3 }, iconButton: { alignItems: "center", backgroundColor: "#F5F5F8", borderRadius: 14, height: 44, justifyContent: "center", width: 44 },
  settingsBlock: { backgroundColor: "#F7F7FB", borderRadius: 20, marginBottom: 17, padding: 16 }, settingsLabel: { color: "#73778A", fontSize: 10, fontWeight: "800", letterSpacing: 0.9, marginBottom: 10 }, settingRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 }, settingRowBorder: { borderTopColor: "#E3E4EB", borderTopWidth: 1, marginTop: 8, paddingTop: 16 }, settingTitle: { color: "#232532", fontSize: 14, fontWeight: "800" }, settingText: { color: "#7A7E90", fontSize: 11, marginTop: 3 }, segmentedControl: { backgroundColor: "#E6E7EE", borderRadius: 11, flexDirection: "row", padding: 3 }, segment: { borderRadius: 8, paddingHorizontal: 11, paddingVertical: 7 }, segmentActive: { backgroundColor: "#FFFFFF" }, segmentText: { color: "#747789", fontSize: 12, fontWeight: "800" }, segmentTextActive: { color: "#3657D7" }, applyButton: { alignItems: "center", backgroundColor: "#2D3C9E", borderRadius: 17, flexDirection: "row", gap: 9, justifyContent: "center", minHeight: 57 }, applyButtonDisabled: { backgroundColor: "#A8ACBB" }, applyButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" }, systemNote: { color: "#888C9C", fontSize: 11, lineHeight: 16, marginTop: 11, textAlign: "center" }, pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
});
