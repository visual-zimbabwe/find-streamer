package kkadogo.findstreamer.com

import android.content.ComponentName
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Parcelable
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

    @ReactMethod
    fun launchPlayer(streamUrl: String, title: String?, subtitleUri: String?, promise: Promise) {
        try {
            val context = reactApplicationContext.currentActivity ?: reactApplicationContext
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(Uri.parse(streamUrl), "video/*")
                component = ComponentName("is.xyz.mpv", "is.xyz.mpv.MPVActivity")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
                if (!title.isNullOrBlank()) {
                    putExtra("title", title)
                }
                if (!subtitleUri.isNullOrBlank()) {
                    val subUri = Uri.parse(subtitleUri)
                    val subArray = arrayOf<Parcelable>(subUri)
                    putExtra("subs", subArray)
                    putExtra("subs.enable", subArray)
                    putExtra("subtitles_location", subtitleUri)
                }
            }
            context.startActivity(intent)
            promise.resolve(true)
        } catch (e: Throwable) {
            promise.reject("LAUNCH_PLAYER_ERROR", e.message, e)
        }
    }
}
