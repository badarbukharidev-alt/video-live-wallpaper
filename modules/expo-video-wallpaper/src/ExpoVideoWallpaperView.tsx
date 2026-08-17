import { requireNativeView } from 'expo';
import * as React from 'react';

import { ExpoVideoWallpaperViewProps } from './ExpoVideoWallpaper.types';

const NativeView: React.ComponentType<ExpoVideoWallpaperViewProps> =
  requireNativeView('ExpoVideoWallpaper');

export default function ExpoVideoWallpaperView(props: ExpoVideoWallpaperViewProps) {
  return <NativeView {...props} />;
}
