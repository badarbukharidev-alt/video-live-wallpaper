import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";

const links = [
  { label: "Portfolio", value: "badarbukhari.me", icon: "language" as const, url: "https://www.badarbukhari.me" },
  { label: "YouTube", value: "@BadarBukhariDev", icon: "play-circle-outline" as const, url: "https://www.youtube.com/@BadarBukhariDev" },
  { label: "Instagram", value: "@syedzadabadar", icon: "camera-alt" as const, url: "https://www.instagram.com/syedzadabadar/" },
];

export default function AboutScreen() {
  const openLink = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Link unavailable", "This link could not be opened on this device.");
    }
  };

  return <ScreenContainer className="px-0" containerClassName="bg-background"><StatusBar style="dark" /><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><View style={styles.header}><Pressable onPress={() => router.back()} style={styles.backButton}><MaterialIcons color="#252A45" name="arrow-back" size={23} /></Pressable><Text style={styles.headerTitle}>About</Text><View style={styles.headerSpacer} /></View><View style={styles.hero}><Image source={require("../assets/images/icon.png")} style={styles.logoImage} /><Text style={styles.appName}>Video Live Wallpaper</Text><Text style={styles.tagline}>Make your screen move.</Text><Text style={styles.description}>Explore a curated motion catalog or choose your own device video, preview it in portrait, then let Android confirm the live wallpaper change.</Text></View><Text style={styles.eyebrow}>DEVELOPER</Text><View style={styles.developerCard}><View style={styles.avatar}><Text style={styles.avatarText}>BB</Text></View><View><Text style={styles.developerName}>Badar Bukhari</Text><Text style={styles.developerRole}>Developer & creator</Text></View></View><Text style={styles.eyebrow}>FIND BADAR ONLINE</Text><View style={styles.linksCard}>{links.map((link, index) => <Pressable key={link.label} onPress={() => void openLink(link.url)} style={[styles.linkRow, index < links.length - 1 && styles.linkDivider]}><View style={styles.linkIcon}><MaterialIcons color="#3657D7" name={link.icon} size={21} /></View><View style={styles.linkCopy}><Text style={styles.linkLabel}>{link.label}</Text><Text style={styles.linkValue}>{link.value}</Text></View><MaterialIcons color="#7D8294" name="open-in-new" size={19} /></Pressable>)}</View><View style={styles.note}><MaterialIcons color="#4054B5" name="privacy-tip" size={19} /><Text style={styles.noteText}>Your chosen device videos stay on your device. Android controls the final live-wallpaper permission.</Text></View></ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({ content: { gap: 16, paddingBottom: 34, paddingHorizontal: 20, paddingTop: 12 }, header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" }, backButton: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E5E6ED", borderRadius: 15, borderWidth: 1, height: 44, justifyContent: "center", width: 44 }, headerTitle: { color: "#1B1D29", fontSize: 17, fontWeight: "800" }, headerSpacer: { width: 44 }, hero: { alignItems: "center", backgroundColor: "#EEF0FF", borderRadius: 28, marginTop: 2, padding: 28 }, logoImage: { borderRadius: 22, height: 78, marginBottom: 15, width: 78 }, appName: { color: "#20233A", fontSize: 23, fontWeight: "800", letterSpacing: -0.5 }, tagline: { color: "#4058D7", fontSize: 14, fontWeight: "800", marginTop: 5 }, description: { color: "#59617A", fontSize: 13, lineHeight: 20, marginTop: 15, textAlign: "center" }, eyebrow: { color: "#70758A", fontSize: 10, fontWeight: "800", letterSpacing: 1.05, marginTop: 5 }, developerCard: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E7E8EF", borderRadius: 20, borderWidth: 1, flexDirection: "row", gap: 13, padding: 15 }, avatar: { alignItems: "center", backgroundColor: "#283D9D", borderRadius: 18, height: 54, justifyContent: "center", width: 54 }, avatarText: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" }, developerName: { color: "#20222F", fontSize: 16, fontWeight: "800" }, developerRole: { color: "#777C8D", fontSize: 12, fontWeight: "600", marginTop: 3 }, linksCard: { backgroundColor: "#FFFFFF", borderColor: "#E7E8EF", borderRadius: 20, borderWidth: 1, overflow: "hidden" }, linkRow: { alignItems: "center", flexDirection: "row", gap: 12, padding: 15 }, linkDivider: { borderBottomColor: "#ECECF1", borderBottomWidth: 1 }, linkIcon: { alignItems: "center", backgroundColor: "#EEF0FF", borderRadius: 12, height: 40, justifyContent: "center", width: 40 }, linkCopy: { flex: 1 }, linkLabel: { color: "#282A36", fontSize: 14, fontWeight: "800" }, linkValue: { color: "#74798C", fontSize: 11, marginTop: 2 }, note: { alignItems: "flex-start", backgroundColor: "#E7F4EC", borderRadius: 18, flexDirection: "row", gap: 10, padding: 14 }, noteText: { color: "#37634F", flex: 1, fontSize: 12, lineHeight: 18 } });
