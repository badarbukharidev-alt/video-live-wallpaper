import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";
import { VideoView, useVideoPlayer } from "expo-video";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import {
  DEFAULT_PREVIEW_PREFERENCES,
  inferWallpaperCategory,
  loadPreviewPreferences,
  loadWallpaperLibrary,
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

const FILTERS: GalleryFilter[] = ["All", "Favorites", "Recent", "Nature", "Abstract", "City", "Calm"];

function formatSelectedAt(isoDate: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(isoDate));
}

function isMatchingFilter(item: WallpaperLibraryItem, filter: GalleryFilter) {
  if (filter === "All") return true;
  if (filter === "Favorites") return item.isFavorite;
  return item.category === filter;
}

function actionLabel(operation: "selecting" | "applying" | null) {
  if (operation === "selecting") return "Choosing video…";
  if (operation === "applying") return "Opening Android…";
  return "Set live wallpaper";
}

export default function WallpaperHomeScreen() {
  const [selection, setSelection] = useState<WallpaperSelection | null>(null);
  const [library, setLibrary] = useState<WallpaperLibraryItem[]>([]);
  const [preferences, setPreferences] = useState<PreviewPreferences>(DEFAULT_PREVIEW_PREFERENCES);
  const [activeFilter, setActiveFilter] = useState<GalleryFilter>("All");
  const [activeTab, setActiveTab] = useState<HomeTab>("Explore");
  const [isReady, setIsReady] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [operation, setOperation] = useState<"selecting" | "applying" | null>(null);

  const player = useVideoPlayer(selection?.uri ?? null, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = preferences.muted;
  });

  const canApplyWallpaper = Platform.OS === "android" && ExpoVideoWallpaperModule.isSupported();
  const selectedItem = useMemo(
    () => library.find((item) => item.uri === selection?.uri) ?? null,
    [library, selection?.uri],
  );
  const visibleLibrary = useMemo(() => {
    const filtered = library.filter((item) => isMatchingFilter(item, activeFilter));
    if (activeTab === "Favorites") return filtered.filter((item) => item.isFavorite);
    if (activeTab === "Library") return filtered;
    return filtered.slice(0, 3);
  }, [activeFilter, activeTab, library]);

  useEffect(() => {
    const hydrate = async () => {
      const [savedSelection, savedLibrary, savedPreferences] = await Promise.all([
        loadWallpaperSelection(AsyncStorage),
        loadWallpaperLibrary(AsyncStorage),
        loadPreviewPreferences(AsyncStorage),
      ]);
      setSelection(savedSelection);
      setLibrary(savedLibrary);
      setPreferences(savedPreferences);
      setIsReady(true);
    };
    void hydrate();
  }, []);

  useEffect(() => {
    player.muted = preferences.muted;
    if (selection?.uri) player.play();
  }, [player, preferences.muted, selection?.uri]);

  const persistLibrary = useCallback(async (nextLibrary: WallpaperLibraryItem[]) => {
    setLibrary(nextLibrary);
    await saveWallpaperLibrary(AsyncStorage, nextLibrary);
  }, []);

  const persistPreferences = useCallback(async (nextPreferences: PreviewPreferences) => {
    setPreferences(nextPreferences);
    await savePreviewPreferences(AsyncStorage, nextPreferences);
  }, []);

  const persistSelection = useCallback(async (nextSelection: WallpaperSelection) => {
    setSelection(nextSelection);
    await saveWallpaperSelection(AsyncStorage, nextSelection);
  }, []);

  const selectLibraryItem = useCallback(
    async (item: WallpaperLibraryItem) => {
      try {
        const activeVideo = canApplyWallpaper
          ? await ExpoVideoWallpaperModule.setActiveVideoAsync(item.uri, item.name)
          : item;
        await persistSelection({
          uri: activeVideo.uri,
          name: activeVideo.name,
          mimeType: item.mimeType,
          selectedAt: new Date().toISOString(),
        });
        setIsDetailOpen(true);
      } catch {
        Alert.alert("Video unavailable", "Choose the video again to restore this wallpaper card.");
      }
    },
    [canApplyWallpaper, persistSelection],
  );

  const chooseVideo = useCallback(async () => {
    setOperation("selecting");
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
        allowsMultipleSelection: false,
        quality: 1,
      });
      if (result.canceled) return;

      const video = result.assets[0];
      const baseSelection: WallpaperSelection = {
        uri: video.uri,
        name: video.fileName ?? "Untitled motion",
        mimeType: video.mimeType ?? null,
        selectedAt: new Date().toISOString(),
      };
      const storedVideo = canApplyWallpaper
        ? await ExpoVideoWallpaperModule.storeVideoAsync(baseSelection.uri, baseSelection.name)
        : baseSelection;
      const nextSelection = { ...baseSelection, uri: storedVideo.uri, name: storedVideo.name };
      const newItem: WallpaperLibraryItem = {
        ...nextSelection,
        id: storedVideo.uri,
        category: inferWallpaperCategory(nextSelection.name),
        isFavorite: false,
      };
      const nextLibrary = [newItem, ...library.filter((item) => item.uri !== newItem.uri)];
      await Promise.all([persistLibrary(nextLibrary), persistSelection(nextSelection)]);
      setActiveTab("Explore");
      setIsDetailOpen(true);
      if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      Alert.alert("Video unavailable", "Choose a locally stored video and try again.");
    } finally {
      setOperation(null);
    }
  }, [canApplyWallpaper, library, persistLibrary, persistSelection]);

  const toggleFavorite = useCallback(async () => {
    if (!selectedItem) return;
    const nextLibrary = library.map((item) =>
      item.uri === selectedItem.uri ? { ...item, isFavorite: !item.isFavorite } : item,
    );
    await persistLibrary(nextLibrary);
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [library, persistLibrary, selectedItem]);

  const applyWallpaper = useCallback(async () => {
    if (!selection) return;
    if (!canApplyWallpaper) {
      Alert.alert(
        "Android development build required",
        "The gallery works here, but applying a real live wallpaper needs the custom Android development build.",
      );
      return;
    }
    setOperation("applying");
    try {
      await ExpoVideoWallpaperModule.setActiveVideoAsync(selection.uri, selection.name);
      await ExpoVideoWallpaperModule.openWallpaperPreviewAsync();
      if (Platform.OS !== "web") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      Alert.alert("Could not prepare wallpaper", "Select the video again, then retry the Android wallpaper action.");
    } finally {
      setOperation(null);
    }
  }, [canApplyWallpaper, selection]);

  const updateMuted = useCallback(
    (muted: boolean) => void persistPreferences({ ...preferences, muted }),
    [persistPreferences, preferences],
  );

  const updateFitMode = useCallback(
    (fitMode: PreviewPreferences["fitMode"]) => void persistPreferences({ ...preferences, fitMode }),
    [persistPreferences, preferences],
  );

  return (
    <ScreenContainer className="px-0" containerClassName="bg-background">
      <StatusBar style="dark" />
      <View style={styles.page}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View>
              <Text style={styles.kicker}>VIDEO LIVE WALLPAPER</Text>
              <Text style={styles.brand}>Explore</Text>
            </View>
            <Pressable onPress={() => void chooseVideo()} style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}>
              <MaterialIcons color="#252A45" name="add" size={24} />
            </Pressable>
          </View>

          <Pressable onPress={() => void chooseVideo()} style={({ pressed }) => [styles.searchBar, pressed && styles.pressed]}>
            {operation === "selecting" ? <ActivityIndicator color="#3657D7" /> : <MaterialIcons color="#5F6480" name="search" size={21} />}
            <Text style={styles.searchText}>Choose a video from your device</Text>
            <MaterialIcons color="#3657D7" name="arrow-forward" size={19} />
          </Pressable>

          <ScrollView contentContainerStyle={styles.chipRow} horizontal showsHorizontalScrollIndicator={false}>
            {FILTERS.map((filter) => (
              <Pressable
                key={filter}
                onPress={() => setActiveFilter(filter)}
                style={({ pressed }) => [styles.chip, activeFilter === filter && styles.chipActive, pressed && styles.pressed]}
              >
                <Text style={[styles.chipLabel, activeFilter === filter && styles.chipLabelActive]}>{filter}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.sectionEyebrow}>WALL OF THE DAY</Text>
          <Pressable
            disabled={!selection}
            onPress={() => setIsDetailOpen(true)}
            style={({ pressed }) => [styles.heroCard, pressed && selection && styles.pressed]}
          >
            {selection ? (
              <VideoView contentFit={preferences.fitMode} nativeControls={false} player={player} style={styles.heroVideo} surfaceType="textureView" />
            ) : (
              <View style={styles.heroEmpty}>
                <View style={styles.heroGlowOne} />
                <View style={styles.heroGlowTwo} />
                <MaterialIcons color="#FFFFFF" name="play-circle-fill" size={48} />
                <Text style={styles.heroEmptyTitle}>Turn a video into your view.</Text>
                <Text style={styles.heroEmptyCopy}>Pick a clip and make your lock screen move.</Text>
              </View>
            )}
            <View style={styles.heroShade} />
            <View style={styles.heroMeta}>
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveBadgeText}>{selection ? "ACTIVE WALL" : "YOUR NEXT WALL"}</Text>
              </View>
              <View style={styles.heroFooter}>
                <View style={styles.heroCopy}>
                  <Text numberOfLines={1} style={styles.heroTitle}>{selection?.name ?? "Motion starts here"}</Text>
                  <Text style={styles.heroSubtitle}>
                    {selection ? `${selectedItem?.category ?? "Recent"} · Saved ${formatSelectedAt(selection.selectedAt)}` : "Choose a local video to begin"}
                  </Text>
                </View>
                <View style={styles.favoriteCircle}>
                  <MaterialIcons color="#FFFFFF" name={selectedItem?.isFavorite ? "favorite" : "favorite-border"} size={22} />
                </View>
              </View>
            </View>
          </Pressable>

          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>{activeTab === "Favorites" ? "Your favorites" : activeTab === "Library" ? "Your library" : "Recently added"}</Text>
            <Pressable onPress={() => setActiveTab("Library")} style={({ pressed }) => pressed && styles.pressed}>
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          </View>

          {visibleLibrary.length > 0 ? (
            <View style={styles.cardGrid}>
              {visibleLibrary.map((item) => (
                <Pressable key={item.id} onPress={() => void selectLibraryItem(item)} style={({ pressed }) => [styles.libraryCard, pressed && styles.pressed]}>
                  <View style={[styles.cardArt, { backgroundColor: item.category === "Nature" ? "#BEE1D2" : item.category === "Abstract" ? "#BFC7F7" : item.category === "City" ? "#D5C4E9" : "#F1CBAF" }]}>
                    <MaterialIcons color="rgba(20,21,29,0.67)" name="play-circle-filled" size={30} />
                    {item.uri === selection?.uri ? <View style={styles.activePill}><Text style={styles.activePillText}>ACTIVE</Text></View> : null}
                  </View>
                  <View style={styles.cardFooter}>
                    <Text numberOfLines={1} style={styles.cardTitle}>{item.name}</Text>
                    <MaterialIcons color={item.isFavorite ? "#E74B5C" : "#8A8E9E"} name={item.isFavorite ? "favorite" : "favorite-border"} size={18} />
                  </View>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.emptyLibrary}>
              <MaterialIcons color="#7581D7" name={activeTab === "Favorites" ? "favorite-border" : "video-library"} size={28} />
              <Text style={styles.emptyLibraryTitle}>{activeTab === "Favorites" ? "No favorites yet" : "Your video shelf is empty"}</Text>
              <Text style={styles.emptyLibraryCopy}>Choose a local video to create your first live-wallpaper card.</Text>
            </View>
          )}

          <View style={styles.infoCard}>
            <View style={styles.infoIcon}><MaterialIcons color="#3657D7" name="auto-awesome" size={19} /></View>
            <View style={styles.infoCopy}>
              <Text style={styles.infoTitle}>Made for your own videos</Text>
              <Text style={styles.infoText}>Your selected clips stay on this device. Android confirms every real wallpaper change.</Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.bottomDock}>
          {([
            ["Explore", "explore"],
            ["Library", "video-library"],
            ["Favorites", "favorite-border"],
          ] as const).map(([label, icon]) => (
            <Pressable key={label} onPress={() => setActiveTab(label)} style={({ pressed }) => [styles.dockItem, pressed && styles.pressed]}>
              <MaterialIcons color={activeTab === label ? "#3657D7" : "#9094A4"} name={icon} size={24} />
              <Text style={[styles.dockLabel, activeTab === label && styles.dockLabelActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Modal animationType="slide" onRequestClose={() => setIsDetailOpen(false)} transparent visible={isDetailOpen}>
        <View style={styles.modalBackdrop}>
          <Pressable onPress={() => setIsDetailOpen(false)} style={StyleSheet.absoluteFill} />
          <View style={styles.detailSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.detailHeader}>
              <View style={styles.detailThumb}><MaterialIcons color="#3657D7" name="movie-filter" size={27} /></View>
              <View style={styles.detailHeaderCopy}>
                <Text numberOfLines={1} style={styles.detailTitle}>{selection?.name ?? "Choose a video"}</Text>
                <Text style={styles.detailSubtitle}>{selectedItem?.category ?? "Local video"} · Ready for Android</Text>
              </View>
              <Pressable disabled={!selectedItem} onPress={() => void toggleFavorite()} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
                <MaterialIcons color={selectedItem?.isFavorite ? "#E74B5C" : "#3D4259"} name={selectedItem?.isFavorite ? "favorite" : "favorite-border"} size={24} />
              </Pressable>
            </View>

            <View style={styles.settingsBlock}>
              <Text style={styles.settingsLabel}>PREVIEW SETTINGS</Text>
              <View style={styles.settingRow}>
                <View>
                  <Text style={styles.settingTitle}>Video fit</Text>
                  <Text style={styles.settingText}>Choose how the clip fills your screen.</Text>
                </View>
                <View style={styles.segmentedControl}>
                  {(["cover", "contain"] as const).map((fitMode) => (
                    <Pressable key={fitMode} onPress={() => updateFitMode(fitMode)} style={[styles.segment, preferences.fitMode === fitMode && styles.segmentActive]}>
                      <Text style={[styles.segmentText, preferences.fitMode === fitMode && styles.segmentTextActive]}>{fitMode === "cover" ? "Fill" : "Fit"}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={[styles.settingRow, styles.settingRowBorder]}>
                <View>
                  <Text style={styles.settingTitle}>Mute preview</Text>
                  <Text style={styles.settingText}>Live wallpaper audio stays muted.</Text>
                </View>
                <Switch onValueChange={updateMuted} thumbColor="#FFFFFF" trackColor={{ false: "#C7CAD6", true: "#3657D7" }} value={preferences.muted} />
              </View>
            </View>

            <Pressable
              disabled={!selection || !isReady || operation !== null}
              onPress={() => void applyWallpaper()}
              style={({ pressed }) => [styles.applyButton, (!selection || !isReady || operation !== null) && styles.applyButtonDisabled, pressed && styles.pressed]}
            >
              {operation === "applying" ? <ActivityIndicator color="#FFFFFF" /> : <MaterialIcons color="#FFFFFF" name="wallpaper" size={21} />}
              <Text style={styles.applyButtonText}>{actionLabel(operation)}</Text>
            </Pressable>
            <Text style={styles.systemNote}>Android opens the final system confirmation next.</Text>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: "#F7F7FB", flex: 1 },
  scrollContent: { gap: 18, paddingBottom: 108, paddingHorizontal: 20, paddingTop: 14 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  kicker: { color: "#6D7190", fontSize: 10, fontWeight: "800", letterSpacing: 1.15 },
  brand: { color: "#151622", fontSize: 31, fontWeight: "800", letterSpacing: -1.2, marginTop: 1 },
  headerAction: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E5E6ED", borderRadius: 18, borderWidth: 1, height: 46, justifyContent: "center", shadowColor: "#1B1D2A", shadowOpacity: 0.05, shadowRadius: 12, width: 46 },
  searchBar: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E7E8EF", borderRadius: 17, borderWidth: 1, flexDirection: "row", gap: 11, minHeight: 54, paddingHorizontal: 15 },
  searchText: { color: "#787C8C", flex: 1, fontSize: 14, fontWeight: "600" },
  chipRow: { gap: 8, paddingRight: 20 },
  chip: { backgroundColor: "#ECECF3", borderRadius: 999, paddingHorizontal: 15, paddingVertical: 9 },
  chipActive: { backgroundColor: "#1D1F2B" },
  chipLabel: { color: "#565A6A", fontSize: 13, fontWeight: "700" },
  chipLabelActive: { color: "#FFFFFF" },
  sectionEyebrow: { color: "#6D7190", fontSize: 10, fontWeight: "800", letterSpacing: 1.1, marginTop: 2 },
  heroCard: { backgroundColor: "#6275D5", borderRadius: 27, height: 320, overflow: "hidden", position: "relative", shadowColor: "#6677D6", shadowOpacity: 0.22, shadowRadius: 22 },
  heroVideo: { height: "100%", width: "100%" },
  heroEmpty: { alignItems: "center", backgroundColor: "#5268D7", flex: 1, justifyContent: "center", overflow: "hidden", paddingHorizontal: 40 },
  heroGlowOne: { backgroundColor: "#8EA0FF", borderRadius: 130, height: 240, opacity: 0.54, position: "absolute", right: -85, top: -72, width: 240 },
  heroGlowTwo: { backgroundColor: "#CEB7FF", borderRadius: 95, bottom: -46, height: 178, left: -54, opacity: 0.4, position: "absolute", width: 178 },
  heroEmptyTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "800", letterSpacing: -0.5, marginTop: 13, textAlign: "center" },
  heroEmptyCopy: { color: "#E6E9FF", fontSize: 14, lineHeight: 20, marginTop: 7, textAlign: "center" },
  heroShade: { backgroundColor: "rgba(0,0,0,0.2)", bottom: 0, height: 145, left: 0, position: "absolute", right: 0 },
  heroMeta: { bottom: 17, left: 17, position: "absolute", right: 17 },
  liveBadge: { alignItems: "center", alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.22)", borderColor: "rgba(255,255,255,0.36)", borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 10, paddingVertical: 6 },
  liveDot: { backgroundColor: "#80FFD5", borderRadius: 4, height: 7, width: 7 },
  liveBadgeText: { color: "#FFFFFF", fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  heroFooter: { alignItems: "flex-end", flexDirection: "row", justifyContent: "space-between", marginTop: 13 },
  heroCopy: { flex: 1, paddingRight: 12 },
  heroTitle: { color: "#FFFFFF", fontSize: 21, fontWeight: "800", letterSpacing: -0.5 },
  heroSubtitle: { color: "#F2F3FF", fontSize: 12, fontWeight: "600", marginTop: 3 },
  favoriteCircle: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.18)", borderColor: "rgba(255,255,255,0.35)", borderRadius: 17, borderWidth: 1, height: 40, justifyContent: "center", width: 40 },
  sectionHeading: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  sectionTitle: { color: "#171824", fontSize: 19, fontWeight: "800", letterSpacing: -0.35 },
  seeAll: { color: "#3657D7", fontSize: 13, fontWeight: "800" },
  cardGrid: { flexDirection: "row", gap: 11 },
  libraryCard: { backgroundColor: "#FFFFFF", borderColor: "#EAEBF0", borderRadius: 18, borderWidth: 1, flex: 1, overflow: "hidden" },
  cardArt: { alignItems: "center", height: 116, justifyContent: "center", position: "relative" },
  activePill: { backgroundColor: "#171824", borderRadius: 999, bottom: 8, left: 8, paddingHorizontal: 7, paddingVertical: 4, position: "absolute" },
  activePillText: { color: "#FFFFFF", fontSize: 8, fontWeight: "800", letterSpacing: 0.55 },
  cardFooter: { alignItems: "center", flexDirection: "row", gap: 5, minHeight: 48, paddingHorizontal: 10 },
  cardTitle: { color: "#323543", flex: 1, fontSize: 12, fontWeight: "700" },
  emptyLibrary: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E7E8EF", borderRadius: 20, borderStyle: "dashed", borderWidth: 1, gap: 8, minHeight: 150, justifyContent: "center", paddingHorizontal: 34 },
  emptyLibraryTitle: { color: "#2A2D3B", fontSize: 15, fontWeight: "800" },
  emptyLibraryCopy: { color: "#777B8D", fontSize: 13, lineHeight: 19, textAlign: "center" },
  infoCard: { alignItems: "flex-start", backgroundColor: "#E8EBFF", borderRadius: 19, flexDirection: "row", gap: 12, padding: 15 },
  infoIcon: { alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 12, height: 38, justifyContent: "center", width: 38 },
  infoCopy: { flex: 1, gap: 3 },
  infoTitle: { color: "#2E3976", fontSize: 14, fontWeight: "800" },
  infoText: { color: "#59618B", fontSize: 12, lineHeight: 18 },
  bottomDock: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.97)", borderColor: "#E5E6ED", borderRadius: 24, borderWidth: 1, bottom: 13, flexDirection: "row", justifyContent: "space-around", left: 20, paddingVertical: 10, position: "absolute", right: 20, shadowColor: "#242631", shadowOpacity: 0.11, shadowRadius: 16 },
  dockItem: { alignItems: "center", gap: 3, minWidth: 62 },
  dockLabel: { color: "#9094A4", fontSize: 10, fontWeight: "700" },
  dockLabelActive: { color: "#3657D7" },
  modalBackdrop: { backgroundColor: "rgba(21,22,34,0.34)", flex: 1, justifyContent: "flex-end" },
  detailSheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingBottom: 32, paddingHorizontal: 21, paddingTop: 12 },
  sheetHandle: { alignSelf: "center", backgroundColor: "#D8DAE3", borderRadius: 99, height: 4, marginBottom: 18, width: 44 },
  detailHeader: { alignItems: "center", flexDirection: "row", gap: 11, marginBottom: 20 },
  detailThumb: { alignItems: "center", backgroundColor: "#E8EBFF", borderRadius: 15, height: 53, justifyContent: "center", width: 53 },
  detailHeaderCopy: { flex: 1 },
  detailTitle: { color: "#191A27", fontSize: 17, fontWeight: "800" },
  detailSubtitle: { color: "#777B8D", fontSize: 12, fontWeight: "600", marginTop: 3 },
  iconButton: { alignItems: "center", backgroundColor: "#F5F5F8", borderRadius: 14, height: 44, justifyContent: "center", width: 44 },
  settingsBlock: { backgroundColor: "#F7F7FB", borderRadius: 20, marginBottom: 17, padding: 16 },
  settingsLabel: { color: "#73778A", fontSize: 10, fontWeight: "800", letterSpacing: 0.9, marginBottom: 10 },
  settingRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 },
  settingRowBorder: { borderTopColor: "#E3E4EB", borderTopWidth: 1, marginTop: 8, paddingTop: 16 },
  settingTitle: { color: "#232532", fontSize: 14, fontWeight: "800" },
  settingText: { color: "#7A7E90", fontSize: 11, marginTop: 3 },
  segmentedControl: { backgroundColor: "#E6E7EE", borderRadius: 11, flexDirection: "row", padding: 3 },
  segment: { borderRadius: 8, paddingHorizontal: 11, paddingVertical: 7 },
  segmentActive: { backgroundColor: "#FFFFFF", shadowColor: "#303242", shadowOpacity: 0.08, shadowRadius: 5 },
  segmentText: { color: "#747789", fontSize: 12, fontWeight: "800" },
  segmentTextActive: { color: "#3657D7" },
  applyButton: { alignItems: "center", backgroundColor: "#2D3C9E", borderRadius: 17, flexDirection: "row", gap: 9, justifyContent: "center", minHeight: 57 },
  applyButtonDisabled: { backgroundColor: "#A8ACBB" },
  applyButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  systemNote: { color: "#888C9C", fontSize: 11, lineHeight: 16, marginTop: 11, textAlign: "center" },
  pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
});
