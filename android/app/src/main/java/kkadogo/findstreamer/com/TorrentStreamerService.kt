package kkadogo.findstreamer.com

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.wifi.WifiManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat

class TorrentStreamerService : Service() {
    companion object {
        private const val TAG = "TorrentStreamerService"
        const val CHANNEL_ID = "trova_stream_channel"
        const val NOTIFICATION_ID = 88991
        const val ACTION_START = "kkadogo.findstreamer.com.ACTION_START_STREAM"
        const val ACTION_STOP = "kkadogo.findstreamer.com.ACTION_STOP_STREAM"
        const val EXTRA_TITLE = "extra_title"

        @Volatile
        var isRunning = false
            private set
    }

    private var wakeLock: PowerManager.WakeLock? = null
    private var wifiLock: WifiManager.WifiLock? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action ?: ACTION_START
        if (action == ACTION_STOP) {
            Log.i(TAG, "Stopping TorrentStreamerService via ACTION_STOP")
            stopServiceInternal()
            return START_NOT_STICKY
        }

        val title = intent?.getStringExtra(EXTRA_TITLE) ?: "Trova Streamer"
        Log.i(TAG, "Starting TorrentStreamerService foreground execution for: $title")

        startForegroundInternal(title)
        acquireLocks()
        ensureEngineRunning()

        isRunning = true
        return START_NOT_STICKY
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Trova Stream Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Maintains torrent streaming engine active while external media player is playing"
                setShowBadge(false)
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            manager?.createNotificationChannel(channel)
        }
    }

    private fun startForegroundInternal(title: String) {
        val stopIntent = Intent(this, TorrentStreamerService::class.java).apply {
            this.action = ACTION_STOP
        }
        val stopPendingIntent = PendingIntent.getService(
            this,
            1,
            stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        )

        val mainIntent = Intent(this, MainActivity::class.java).apply {
            this.flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val contentPendingIntent = PendingIntent.getActivity(
            this,
            0,
            mainIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Streaming: $title")
            .setContentText("Trova background stream server is active")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(contentPendingIntent)
            .setOngoing(true)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop", stopPendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun acquireLocks() {
        try {
            if (wakeLock == null) {
                val powerManager = getSystemService(Context.POWER_SERVICE) as? PowerManager
                wakeLock = powerManager?.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK,
                    "Trova:TorrentStreamerWakeLock"
                )?.apply {
                    setReferenceCounted(false)
                    acquire(4 * 60 * 60 * 1000L) // 4 hour maximum
                }
            }
            if (wifiLock == null) {
                val wifiManager = applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
                val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    WifiManager.WIFI_MODE_FULL_LOW_LATENCY
                } else {
                    WifiManager.WIFI_MODE_FULL_HIGH_PERF
                }
                wifiLock = wifiManager?.createWifiLock(mode, "Trova:TorrentStreamerWifiLock")?.apply {
                    setReferenceCounted(false)
                    acquire()
                }
            }
        } catch (e: Throwable) {
            Log.w(TAG, "Failed acquiring wake/wifi lock", e)
        }
    }

    private fun releaseLocks() {
        try {
            wakeLock?.let {
                if (it.isHeld) it.release()
            }
            wakeLock = null
        } catch (e: Throwable) {
            Log.w(TAG, "Error releasing wake lock", e)
        }
        try {
            wifiLock?.let {
                if (it.isHeld) it.release()
            }
            wifiLock = null
        } catch (e: Throwable) {
            Log.w(TAG, "Error releasing wifi lock", e)
        }
    }

    private fun ensureEngineRunning() {
        Thread {
            try {
                val storage = java.io.File(filesDir, "trova_media").absolutePath
                TorrentStreamer.start(storage, 8899)
            } catch (e: Throwable) {
                Log.e(TAG, "Failed ensuring TorrentStreamer running", e)
            }
        }.start()
    }

    private fun stopServiceInternal() {
        releaseLocks()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
        stopSelf()
        isRunning = false
    }

    override fun onDestroy() {
        stopServiceInternal()
        super.onDestroy()
    }
}
