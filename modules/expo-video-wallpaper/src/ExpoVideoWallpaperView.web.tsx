import * as React from 'react';

import { ExpoVideoWallpaperViewProps } from './ExpoVideoWallpaper.types';

export default function ExpoVideoWallpaperView(props: ExpoVideoWallpaperViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
