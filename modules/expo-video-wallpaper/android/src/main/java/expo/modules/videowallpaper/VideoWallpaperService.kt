package expo.modules.videowallpaper

import android.net.Uri
import android.service.wallpaper.WallpaperService
import android.view.SurfaceHolder
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.exoplayer.ExoPlayer
import java.io.File

@UnstableApi
class VideoWallpaperService : WallpaperService() {
  override fun onCreateEngine(): Engine = VideoEngine()

  private inner class VideoEngine : Engine() {
    private var player: ExoPlayer? = null
    private var surfaceHolder: SurfaceHolder? = null
    private var visible = false

    override fun onVisibilityChanged(isVisible: Boolean) {
      visible = isVisible
      if (isVisible) {
        startIfReady()
      } else {
        player?.pause()
      }
    }

    override fun onSurfaceCreated(holder: SurfaceHolder) {
      super.onSurfaceCreated(holder)
      surfaceHolder = holder
      preparePlayer(holder)
    }

    override fun onSurfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
      super.onSurfaceChanged(holder, format, width, height)
      surfaceHolder = holder
      player?.setVideoSurfaceHolder(holder)
    }

    override fun onSurfaceDestroyed(holder: SurfaceHolder) {
      releasePlayer()
      surfaceHolder = null
      super.onSurfaceDestroyed(holder)
    }

    override fun onDestroy() {
      releasePlayer()
      super.onDestroy()
    }

    private fun preparePlayer(holder: SurfaceHolder) {
      releasePlayer()
      val videoPath = getSharedPreferences(PREFERENCES, MODE_PRIVATE)
        .getString(KEY_VIDEO_PATH, null)
        ?: return
      val requestedUri = Uri.parse(videoPath)
      val isRemote = requestedUri.scheme == "https" || requestedUri.scheme == "http"
      if (!isRemote && !File(videoPath).exists()) return
      val sourceUri = if (isRemote) requestedUri else Uri.fromFile(File(videoPath))

      val builder = ExoPlayer.Builder(this@VideoWallpaperService)
      if (isRemote) {
        builder.setMediaSourceFactory(
          DefaultMediaSourceFactory(this@VideoWallpaperService)
            .setDataSourceFactory(VideoCatalogDownloadStore.cacheDataSourceFactory(this@VideoWallpaperService)),
        )
      }
      player = builder.build().apply {
        setVideoSurfaceHolder(holder)
        repeatMode = Player.REPEAT_MODE_ONE
        volume = 0f
        setMediaItem(MediaItem.fromUri(sourceUri))
        playWhenReady = visible
        prepare()
      }
    }

    private fun startIfReady() {
      if (!visible) return
      val player = player ?: return
      if (!player.isPlaying) {
        player.play()
      }
    }

    private fun releasePlayer() {
      player?.release()
      player = null
    }
  }

  private companion object {
    const val PREFERENCES = "video_live_wallpaper"
    const val KEY_VIDEO_PATH = "video_path"
  }
}
