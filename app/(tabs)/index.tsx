import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";
import { VideoView, useVideoPlayer } from "expo-video";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import {
  loadWallpaperSelection,
  saveWallpaperSelection,
  type WallpaperSelection,
} from "@/lib/wallpaper-selection";
import ExpoVideoWallpaperModule from "@/modules/expo-video-wallpaper/src/ExpoVideoWallpaperModule";

function formatSelectedAt(isoDate: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(isoDate));
}

export default function WallpaperHomeScreen() {
  const [selection, setSelection] = useState<WallpaperSelection | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [operation, setOperation] = useState<"selecting" | "preparing" | null>(null);

  const player = useVideoPlayer(selection?.uri ?? null, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = true;
  });

  useEffect(() => {
    const restoreSelection = async () => {
      try {
        const stored = await loadWallpaperSelection(AsyncStorage);
        if (stored) setSelection(stored);
      } catch {
        // The app stays usable if a stale local record cannot be read.
      } finally {
        setIsRestoring(false);
      }
    };

    void restoreSelection();
  }, []);

  useEffect(() => {
    if (selection?.uri) player.play();
  }, [player, selection?.uri]);

  const canApplyWallpaper = useMemo(
    () => Platform.OS === "android" && ExpoVideoWallpaperModule.isSupported(),
    [],
  );

  const saveSelection = useCallback(async (nextSelection: WallpaperSelection) => {
    await saveWallpaperSelection(AsyncStorage, nextSelection);
    setSelection(nextSelection);
  }, []);

  const handleChooseVideo = useCallback(async () => {
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
        name: video.fileName ?? "Selected video",
        mimeType: video.mimeType ?? null,
        selectedAt: new Date().toISOString(),
      };

      if (canApplyWallpaper) {
        const storedVideo = await ExpoVideoWallpaperModule.storeVideoAsync(
          baseSelection.uri,
          baseSelection.name,
        );
        baseSelection.uri = storedVideo.uri;
        baseSelection.name = storedVideo.name;
      }

      await saveSelection(baseSelection);
      if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      Alert.alert(
        "Video unavailable",
        "Choose a video that is stored locally on your Android device and try again.",
      );
    } finally {
      setOperation(null);
    }
  }, [canApplyWallpaper, saveSelection]);

  const handleApplyWallpaper = useCallback(async () => {
    if (!selection) return;

    if (!canApplyWallpaper) {
      Alert.alert(
        "Android development build required",
        "Video preview works here, but a custom Android build is needed before the app can open the real live-wallpaper settings screen.",
      );
      return;
    }

    setOperation("preparing");
    try {
      const storedVideo = await ExpoVideoWallpaperModule.storeVideoAsync(selection.uri, selection.name);
      const refreshedSelection = { ...selection, uri: storedVideo.uri, name: storedVideo.name };
      await saveSelection(refreshedSelection);
      await ExpoVideoWallpaperModule.openWallpaperPreviewAsync();
      if (Platform.OS !== "web") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      Alert.alert(
        "Could not prepare wallpaper",
        "The selected video could not be copied for Android’s live-wallpaper service. Choose it again and retry.",
      );
    } finally {
      setOperation(null);
    }
  }, [canApplyWallpaper, saveSelection, selection]);

  const isBusy = operation !== null;

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.logoMark}>
            <Text style={styles.logoMarkText}>V</Text>
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>ANDROID LIVE WALLPAPER</Text>
            <Text style={styles.title}>Bring your video to life.</Text>
          </View>
        </View>

        <View style={styles.previewCard}>
          {selection ? (
            <VideoView
              contentFit="cover"
              nativeControls={false}
              player={player}
              style={styles.video}
              surfaceType="textureView"
            />
          ) : (
            <View style={styles.emptyPreview}>
              <View style={styles.emptyOrb} />
              <Text style={styles.emptyTitle}>Your moving canvas</Text>
              <Text style={styles.emptyText}>Choose a video to see its looping live-wallpaper preview.</Text>
            </View>
          )}
          <View style={styles.previewOverlay}>
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>{selection ? "LOOPING PREVIEW" : "READY WHEN YOU ARE"}</Text>
            </View>
            <Text style={styles.previewHint}>Video playback is muted on the wallpaper.</Text>
          </View>
        </View>

        <View style={styles.selectionCard}>
          <View style={styles.selectionIcon}>
            <Text style={styles.selectionIconText}>{selection ? "✓" : "+"}</Text>
          </View>
          <View style={styles.selectionCopy}>
            <Text style={styles.selectionLabel}>{selection ? "SELECTED VIDEO" : "NO VIDEO SELECTED"}</Text>
            <Text numberOfLines={1} style={styles.selectionName}>
              {selection ? selection.name : "Choose a clip from your device"}
            </Text>
            {selection ? <Text style={styles.selectionMeta}>Updated {formatSelectedAt(selection.selectedAt)}</Text> : null}
          </View>
        </View>

        {!canApplyWallpaper ? (
          <View style={styles.buildNotice}>
            <Text style={styles.buildNoticeTitle}>Preview mode</Text>
            <Text style={styles.buildNoticeText}>
              The real wallpaper action becomes available in a custom Android development build, not in a browser preview or Expo Go.
            </Text>
          </View>
        ) : null}

        <View style={styles.actionStack}>
          <Pressable
            accessibilityRole="button"
            disabled={isBusy}
            onPress={() => void handleChooseVideo()}
            style={({ pressed }) => [styles.secondaryButton, (pressed || isBusy) && styles.pressedButton]}
          >
            {operation === "selecting" ? <ActivityIndicator color="#D9FEFF" /> : null}
            <Text style={styles.secondaryButtonText}>{selection ? "Choose another video" : "Choose video"}</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={!selection || isBusy || isRestoring}
            onPress={() => void handleApplyWallpaper()}
            style={({ pressed }) => [
              styles.primaryButton,
              (!selection || isBusy || isRestoring) && styles.disabledButton,
              pressed && styles.pressedButton,
            ]}
          >
            {operation === "preparing" ? <ActivityIndicator color="#07121F" /> : null}
            <Text style={styles.primaryButtonText}>
              {operation === "preparing" ? "Preparing video…" : "Set live wallpaper"}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.footerText}>
          Android will show its own confirmation screen next. There, choose where to apply the live wallpaper.
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1, gap: 18, paddingBottom: 28, paddingTop: 12 },
  header: { alignItems: "center", flexDirection: "row", gap: 12, marginBottom: 4 },
  logoMark: { alignItems: "center", backgroundColor: "#133249", borderColor: "#3DE1E6", borderRadius: 14, borderWidth: 1, height: 46, justifyContent: "center", shadowColor: "#3DE1E6", shadowOpacity: 0.25, shadowRadius: 12, width: 46 },
  logoMarkText: { color: "#3DE1E6", fontSize: 21, fontWeight: "800" },
  headerCopy: { flex: 1, gap: 3 },
  eyebrow: { color: "#65E6B2", fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  title: { color: "#EAF6FF", fontSize: 26, fontWeight: "800", letterSpacing: -0.6 },
  previewCard: { backgroundColor: "#10283A", borderColor: "#1E506B", borderRadius: 28, borderWidth: 1, height: 382, overflow: "hidden", position: "relative" },
  video: { height: "100%", width: "100%" },
  emptyPreview: { alignItems: "center", backgroundColor: "#0A1A2A", flex: 1, justifyContent: "center", paddingHorizontal: 36 },
  emptyOrb: { backgroundColor: "#8B5CF6", borderColor: "#A78BFA", borderRadius: 70, borderWidth: 1, height: 116, marginBottom: 24, opacity: 0.9, shadowColor: "#8B5CF6", shadowOpacity: 0.65, shadowRadius: 30, width: 116 },
  emptyTitle: { color: "#EAF6FF", fontSize: 22, fontWeight: "800", marginBottom: 8 },
  emptyText: { color: "#A9C2D4", fontSize: 15, lineHeight: 22, textAlign: "center" },
  previewOverlay: { bottom: 0, left: 0, padding: 18, position: "absolute", right: 0 },
  livePill: { alignItems: "center", alignSelf: "flex-start", backgroundColor: "rgba(7, 18, 31, 0.78)", borderColor: "rgba(234, 246, 255, 0.18)", borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 7, paddingHorizontal: 10, paddingVertical: 6 },
  liveDot: { backgroundColor: "#65E6B2", borderRadius: 4, height: 7, width: 7 },
  liveText: { color: "#EAF6FF", fontSize: 10, fontWeight: "800", letterSpacing: 0.9 },
  previewHint: { color: "#EAF6FF", fontSize: 12, fontWeight: "600", marginTop: 9, textShadowColor: "#07121F", textShadowRadius: 5 },
  selectionCard: { alignItems: "center", backgroundColor: "#10283A", borderColor: "#1E506B", borderRadius: 20, borderWidth: 1, flexDirection: "row", gap: 12, minHeight: 84, padding: 14 },
  selectionIcon: { alignItems: "center", backgroundColor: "#193A51", borderRadius: 13, height: 46, justifyContent: "center", width: 46 },
  selectionIconText: { color: "#3DE1E6", fontSize: 23, fontWeight: "800" },
  selectionCopy: { flex: 1, gap: 3 },
  selectionLabel: { color: "#7FA5BA", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  selectionName: { color: "#EAF6FF", fontSize: 16, fontWeight: "700" },
  selectionMeta: { color: "#A9C2D4", fontSize: 12 },
  buildNotice: { backgroundColor: "#142C3A", borderColor: "#346578", borderRadius: 16, borderWidth: 1, gap: 4, padding: 14 },
  buildNoticeTitle: { color: "#D9FEFF", fontSize: 14, fontWeight: "800" },
  buildNoticeText: { color: "#A9C2D4", fontSize: 13, lineHeight: 19 },
  actionStack: { gap: 10, marginTop: 2 },
  secondaryButton: { alignItems: "center", backgroundColor: "#17364C", borderColor: "#2D607A", borderRadius: 18, borderWidth: 1, flexDirection: "row", gap: 9, justifyContent: "center", minHeight: 54, paddingHorizontal: 20 },
  secondaryButtonText: { color: "#D9FEFF", fontSize: 16, fontWeight: "800" },
  primaryButton: { alignItems: "center", backgroundColor: "#3DE1E6", borderRadius: 18, flexDirection: "row", gap: 9, justifyContent: "center", minHeight: 60, paddingHorizontal: 20, shadowColor: "#3DE1E6", shadowOpacity: 0.3, shadowRadius: 16 },
  primaryButtonText: { color: "#07121F", fontSize: 17, fontWeight: "900" },
  disabledButton: { backgroundColor: "#49616E", shadowOpacity: 0 },
  pressedButton: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  footerText: { color: "#7697AA", fontSize: 12, lineHeight: 18, paddingHorizontal: 8, textAlign: "center" },
});
