package kkadogo.findstreamer.com

import android.content.Intent
import android.os.Build
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class TorrentStreamerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "TorrentStreamerModule"

    @ReactMethod
    fun startService(title: String?, promise: Promise) {
        try {
            val context = reactApplicationContext
            val intent = Intent(context, TorrentStreamerService::class.java).apply {
                action = TorrentStreamerService.ACTION_START
                if (!title.isNullOrBlank()) {
                    putExtra(TorrentStreamerService.EXTRA_TITLE, title)
                }
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ContextCompat.startForegroundService(context, intent)
            } else {
                context.startService(intent)
            }
            promise.resolve(true)
        } catch (e: Throwable) {
            promise.reject("START_SERVICE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stopService(promise: Promise) {
        try {
            val context = reactApplicationContext
            val intent = Intent(context, TorrentStreamerService::class.java).apply {
                action = TorrentStreamerService.ACTION_STOP
            }
            context.startService(intent)
            promise.resolve(true)
        } catch (e: Throwable) {
            promise.reject("STOP_SERVICE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun isServiceRunning(promise: Promise) {
        promise.resolve(TorrentStreamerService.isRunning)
    }
}
