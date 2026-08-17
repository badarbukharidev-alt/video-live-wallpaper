package expo.modules.videowallpaper

import android.app.WallpaperManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream

class ExpoVideoWallpaperModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoVideoWallpaper")

    Function("isSupported") {
      true
    }

    AsyncFunction("storeVideoAsync") { sourceUri: String, displayName: String? ->
      val context = requireContext()
      val resolvedName = displayName?.ifBlank { null } ?: "Selected video"
      val extension = resolvedName.substringAfterLast('.', "mp4").lowercase()
        .replace(Regex("[^a-z0-9]"), "")
        .ifBlank { "mp4" }
      val destination = File(context.filesDir, "live_wallpaper/wallpaper_${System.currentTimeMillis()}.$extension")
      destination.parentFile?.mkdirs()

      openSource(context, Uri.parse(sourceUri)).use { input ->
        FileOutputStream(destination).use { output ->
          input.copyTo(output)
        }
      }

      saveActiveVideo(context, destination, resolvedName)

      mapOf("uri" to Uri.fromFile(destination).toString(), "name" to resolvedName)
    }

    AsyncFunction("setActiveVideoAsync") { storedUri: String, displayName: String? ->
      val context = requireContext()
      val file = File(requireNotNull(Uri.parse(storedUri).path) { "Invalid stored video URI." })
      val libraryDirectory = File(context.filesDir, "live_wallpaper").canonicalPath
      check(file.exists() && file.canonicalPath.startsWith(libraryDirectory)) {
        "The saved wallpaper video is no longer available."
      }
      val resolvedName = displayName?.ifBlank { null } ?: "Selected video"
      saveActiveVideo(context, file, resolvedName)
      mapOf("uri" to Uri.fromFile(file).toString(), "name" to resolvedName)
    }

    AsyncFunction("openWallpaperPreviewAsync") {
      val context = requireContext()
      val storedPath = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
        .getString(KEY_VIDEO_PATH, null)

      check(!storedPath.isNullOrBlank() && File(storedPath).exists()) {
        "Choose a video before opening the Android wallpaper screen."
      }

      val component = ComponentName(context, VideoWallpaperService::class.java)
      val intent = Intent(WallpaperManager.ACTION_CHANGE_LIVE_WALLPAPER).apply {
        putExtra(WallpaperManager.EXTRA_LIVE_WALLPAPER_COMPONENT, component)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      context.startActivity(intent)
      mapOf("opened" to true)
    }

    AsyncFunction("clearStoredVideoAsync") {
      val context = requireContext()
      File(context.filesDir, "live_wallpaper").deleteRecursively()
      context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
        .edit()
        .clear()
        .apply()
    }
  }

  private fun requireContext(): Context {
    return appContext.reactContext
      ?: throw IllegalStateException("Android application context is unavailable.")
  }

  private fun openSource(context: Context, uri: Uri): java.io.InputStream {
    return if (uri.scheme == "file") {
      FileInputStream(File(requireNotNull(uri.path) { "Invalid local video URI." }))
    } else {
      context.contentResolver.openInputStream(uri)
        ?: throw IllegalArgumentException("The selected video can no longer be read.")
    }
  }

  private fun saveActiveVideo(context: Context, file: File, name: String) {
    context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
      .edit()
      .putString(KEY_VIDEO_PATH, file.absolutePath)
      .putString(KEY_VIDEO_NAME, name)
      .apply()
  }

  private companion object {
    const val PREFERENCES = "video_live_wallpaper"
    const val KEY_VIDEO_PATH = "video_path"
    const val KEY_VIDEO_NAME = "video_name"
  }
}
