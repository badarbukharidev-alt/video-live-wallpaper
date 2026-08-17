import { StyleSheet, View } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";

export function CatalogVideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = true;
    videoPlayer.play();
  });

  return (
    <View style={styles.frame}>
      <VideoView contentFit="cover" nativeControls={false} player={player} style={styles.video} surfaceType="textureView" />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { backgroundColor: "#25283B", flex: 1, overflow: "hidden" },
  video: { height: "100%", width: "100%" },
});
