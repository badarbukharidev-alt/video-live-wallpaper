import type { StyleProp, ViewStyle } from "react-native";

export type StoredWallpaperVideo = {
  uri: string;
  name: string;
};

export type ChangeEventPayload = {
  value: string;
};

export type ExpoVideoWallpaperModuleEvents = {
  onChange: (params: ChangeEventPayload) => void;
};

export type OnLoadEventPayload = {
  url: string;
};

export type ExpoVideoWallpaperViewProps = {
  url: string;
  onLoad: (event: { nativeEvent: OnLoadEventPayload }) => void;
  style?: StyleProp<ViewStyle>;
};
