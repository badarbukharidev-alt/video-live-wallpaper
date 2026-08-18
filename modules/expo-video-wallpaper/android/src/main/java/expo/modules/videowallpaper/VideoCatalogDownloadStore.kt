package expo.modules.videowallpaper

import android.content.Context
import android.net.Uri
import androidx.media3.common.MimeTypes
import androidx.media3.common.util.UnstableApi
import androidx.media3.database.StandaloneDatabaseProvider
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.datasource.cache.CacheDataSource
import androidx.media3.datasource.cache.NoOpCacheEvictor
import androidx.media3.datasource.cache.SimpleCache
import androidx.media3.exoplayer.offline.Download
import androidx.media3.exoplayer.offline.DownloadManager
import androidx.media3.exoplayer.offline.DownloadRequest
import java.io.File
import java.util.concurrent.Executor
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.suspendCancellableCoroutine

@UnstableApi
object VideoCatalogDownloadStore {
  @Volatile private var databaseProvider: StandaloneDatabaseProvider? = null
  @Volatile private var downloadCache: SimpleCache? = null
  @Volatile private var downloadManager: DownloadManager? = null

  private fun database(context: Context): StandaloneDatabaseProvider {
    return databaseProvider ?: synchronized(this) {
      databaseProvider ?: StandaloneDatabaseProvider(context.applicationContext)
        .also { databaseProvider = it }
    }
  }

  private fun cache(context: Context): SimpleCache {
    return downloadCache ?: synchronized(this) {
      downloadCache ?: SimpleCache(
        File(context.filesDir, "wallpaper_catalog_cache"),
        NoOpCacheEvictor(),
        database(context),
      ).also { downloadCache = it }
    }
  }

  private fun manager(context: Context): DownloadManager {
    return downloadManager ?: synchronized(this) {
      downloadManager ?: DownloadManager(
        context.applicationContext,
        database(context),
        cache(context),
        DefaultHttpDataSource.Factory(),
        Executor(Runnable::run),
      ).also { manager ->
        manager.maxParallelDownloads = 1
        downloadManager = manager
      }
    }
  }

  private fun request(streamUri: String): DownloadRequest {
    return DownloadRequest.Builder(streamUri, Uri.parse(streamUri))
      .setMimeType(MimeTypes.APPLICATION_M3U8)
      .build()
  }

  fun enqueue(context: Context, streamUri: String) {
    manager(context).addDownload(request(streamUri))
  }

  suspend fun downloadAndAwait(context: Context, streamUri: String) {
    val downloads = manager(context)
    val existing = downloads.downloadIndex.getDownload(streamUri)
    if (existing?.state == Download.STATE_COMPLETED) return

    suspendCancellableCoroutine { continuation ->
      val listener = object : DownloadManager.Listener {
        override fun onDownloadChanged(downloadManager: DownloadManager, download: Download, finalException: Exception?) {
          if (download.request.id != streamUri || !continuation.isActive) return
          when (download.state) {
            Download.STATE_COMPLETED -> {
              downloads.removeListener(this)
              continuation.resume(Unit)
            }
            Download.STATE_FAILED -> {
              downloads.removeListener(this)
              continuation.resumeWithException(finalException ?: IllegalStateException("The catalog video could not finish downloading."))
            }
          }
        }
      }

      downloads.addListener(listener)
      continuation.invokeOnCancellation { downloads.removeListener(listener) }

      val latest = downloads.downloadIndex.getDownload(streamUri)
      when (latest?.state) {
        Download.STATE_COMPLETED -> {
          downloads.removeListener(listener)
          continuation.resume(Unit)
        }
        Download.STATE_FAILED -> {
          downloads.removeListener(listener)
          continuation.resumeWithException(latest.failureReason.let { IllegalStateException("The catalog video could not finish downloading (reason $it).") })
        }
        else -> {
          downloads.addDownload(request(streamUri))
          downloads.resumeDownloads()
        }
      }
    }
  }

  fun cacheDataSourceFactory(context: Context): CacheDataSource.Factory {
    return CacheDataSource.Factory()
      .setCache(cache(context))
      .setUpstreamDataSourceFactory(DefaultHttpDataSource.Factory())
      .setCacheWriteDataSinkFactory(null)
  }
}
