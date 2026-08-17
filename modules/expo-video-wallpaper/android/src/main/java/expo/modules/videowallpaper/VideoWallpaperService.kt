package expo.modules.videowallpaper

import android.media.MediaPlayer
import android.service.wallpaper.WallpaperService
import android.view.SurfaceHolder
import java.io.File

class VideoWallpaperService : WallpaperService() {
  override fun onCreateEngine(): Engine = VideoEngine()

  private inner class VideoEngine : Engine() {
    private var mediaPlayer: MediaPlayer? = null
    private var surfaceHolder: SurfaceHolder? = null
    private var visible = false

    override fun onVisibilityChanged(isVisible: Boolean) {
      visible = isVisible
      if (isVisible) {
        startIfReady()
      } else {
        mediaPlayer?.pause()
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
      mediaPlayer?.setDisplay(holder)
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
      val videoFile = File(videoPath)
      if (!videoFile.exists()) return

      mediaPlayer = MediaPlayer().apply {
        setDisplay(holder)
        setDataSource(videoFile.absolutePath)
        isLooping = true
        setVolume(0f, 0f)
        setOnPreparedListener { startIfReady() }
        setOnErrorListener { _, _, _ ->
          releasePlayer()
          true
        }
        prepareAsync()
      }
    }

    private fun startIfReady() {
      if (!visible) return
      val player = mediaPlayer ?: return
      if (!player.isPlaying) {
        runCatching { player.start() }
      }
    }

    private fun releasePlayer() {
      mediaPlayer?.runCatching {
        stop()
        reset()
        release()
      }
      mediaPlayer = null
    }
  }

  private companion object {
    const val PREFERENCES = "video_live_wallpaper"
    const val KEY_VIDEO_PATH = "video_path"
  }
}
