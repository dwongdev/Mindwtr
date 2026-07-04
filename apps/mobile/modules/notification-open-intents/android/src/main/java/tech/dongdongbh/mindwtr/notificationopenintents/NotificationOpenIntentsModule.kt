package tech.dongdongbh.mindwtr.notificationopenintents

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val PERSISTENT_CAPTURE_CHANNEL_ID = "mindwtr-persistent-capture"
private const val PERSISTENT_CAPTURE_NOTIFICATION_ID = 41120
private const val PERSISTENT_CAPTURE_URI = "mindwtr://open-feature?feature=quick-capture&source=persistent_notification"

class NotificationOpenIntentsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NotificationOpenIntents")

    Function("consumePendingOpenPayload") {
      NotificationOpenPayloadStore.consume()
    }

    Function("showPersistentCaptureNotification") { title: String, text: String, channelName: String ->
      val context = appContext.reactContext ?: return@Function
      val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
        ?: return@Function

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val existingChannel = notificationManager.getNotificationChannel(PERSISTENT_CAPTURE_CHANNEL_ID)
        if (existingChannel == null) {
          val channel = NotificationChannel(
            PERSISTENT_CAPTURE_CHANNEL_ID,
            channelName,
            NotificationManager.IMPORTANCE_LOW
          )
          channel.description = channelName
          channel.enableLights(false)
          channel.enableVibration(false)
          channel.setSound(null, null)
          channel.setShowBadge(false)
          channel.lockscreenVisibility = Notification.VISIBILITY_PUBLIC
          notificationManager.createNotificationChannel(channel)
        }
      }

      val openIntent = Intent(Intent.ACTION_VIEW, Uri.parse(PERSISTENT_CAPTURE_URI)).apply {
        setPackage(context.packageName)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      val pendingFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      } else {
        PendingIntent.FLAG_UPDATE_CURRENT
      }
      val contentIntent = PendingIntent.getActivity(
        context,
        PERSISTENT_CAPTURE_NOTIFICATION_ID,
        openIntent,
        pendingFlags
      )

      val smallIcon = context.resources.getIdentifier("ic_quick_settings_capture", "drawable", context.packageName)
        .takeIf { it != 0 }
        ?: context.applicationInfo.icon

      @Suppress("DEPRECATION")
      val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        Notification.Builder(context, PERSISTENT_CAPTURE_CHANNEL_ID)
      } else {
        Notification.Builder(context).setPriority(Notification.PRIORITY_LOW)
      }
      builder
        .setSmallIcon(smallIcon)
        .setContentTitle(title)
        .setContentText(text)
        .setContentIntent(contentIntent)
        .setOngoing(true)
        .setShowWhen(false)
        .setVisibility(Notification.VISIBILITY_PUBLIC)

      notificationManager.notify(PERSISTENT_CAPTURE_NOTIFICATION_ID, builder.build())
    }

    Function("hidePersistentCaptureNotification") {
      val notificationManager = appContext.reactContext
        ?.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
      notificationManager?.cancel(PERSISTENT_CAPTURE_NOTIFICATION_ID)
    }

    Function("ensureReminderChannel") { channelId: String, channelName: String ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
        return@Function
      }

      val context = appContext.reactContext ?: return@Function
      val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
        ?: return@Function
      val existingChannel = notificationManager.getNotificationChannel(channelId)
      if (existingChannel != null) {
        return@Function
      }

      val channel = NotificationChannel(
        channelId,
        channelName,
        NotificationManager.IMPORTANCE_DEFAULT
      )
      val audioAttributes = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build()

      channel.description = channelName
      channel.enableLights(true)
      channel.lightColor = Color.parseColor("#3b82f6")
      channel.enableVibration(false)
      channel.setSound(Settings.System.DEFAULT_NOTIFICATION_URI, audioAttributes)

      notificationManager.createNotificationChannel(channel)
    }
  }
}
