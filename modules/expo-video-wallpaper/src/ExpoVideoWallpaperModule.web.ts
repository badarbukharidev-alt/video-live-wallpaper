import { registerWebModule, NativeModule } from 'expo';

import { ExpoVideoWallpaperModuleEvents } from './ExpoVideoWallpaper.types';

class ExpoVideoWallpaperModule extends NativeModule<ExpoVideoWallpaperModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
}

export default registerWebModule(ExpoVideoWallpaperModule, 'ExpoVideoWallpaperModule');
