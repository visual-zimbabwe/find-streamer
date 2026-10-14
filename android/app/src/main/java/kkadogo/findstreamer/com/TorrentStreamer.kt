package kkadogo.findstreamer.com

import android.util.Log

object TorrentStreamer {
    private const val TAG = "TorrentStreamer"
    private var isInitialized = false

    init {
        try {
            System.loadLibrary("torrentstreamer")
            Log.i(TAG, "libtorrentstreamer.so loaded successfully")
        } catch (e: UnsatisfiedLinkError) {
            Log.e(TAG, "Failed to load libtorrentstreamer.so", e)
        }
    }

    @JvmStatic
    external fun init(storageDir: String, port: Int): Int

    @Synchronized
    fun start(cacheDir: String, port: Int = 8899): Boolean {
        if (isInitialized) return true
        return try {
            val res = init(cacheDir, port)
            isInitialized = (res == 0)
            Log.i(TAG, "TorrentStreamer initialized on port $port, result=$res")
            isInitialized
        } catch (e: Throwable) {
            Log.e(TAG, "Failed to initialize TorrentStreamer", e)
            false
        }
    }
}
