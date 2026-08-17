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
import androidx.media3.exoplayer.offline.DownloadManager
import androidx.media3.exoplayer.offline.DownloadRequest
import java.io.File
import java.util.concurrent.Executor

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

  fun enqueue(context: Context, streamUri: String) {
    val request = DownloadRequest.Builder(streamUri, Uri.parse(streamUri))
      .setMimeType(MimeTypes.APPLICATION_M3U8)
      .build()
    manager(context).addDownload(request)
  }

  fun cacheDataSourceFactory(context: Context): CacheDataSource.Factory {
    return CacheDataSource.Factory()
      .setCache(cache(context))
      .setUpstreamDataSourceFactory(DefaultHttpDataSource.Factory())
      .setCacheWriteDataSinkFactory(null)
  }
}
