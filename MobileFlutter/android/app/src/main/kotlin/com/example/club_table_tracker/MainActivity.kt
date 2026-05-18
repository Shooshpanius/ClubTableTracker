package com.example.club_table_tracker

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.security.MessageDigest

class MainActivity : FlutterActivity() {

    private val channel = "com.example.club_table_tracker/signing"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)
            val messagesChannel = NotificationChannel(
                "messages",
                "Сообщения",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Уведомления о новых сообщениях в чате"
            }
            manager.createNotificationChannel(messagesChannel)
        }
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, channel)
            .setMethodCallHandler { call, result ->
                if (call.method == "getSha1") {
                    result.success(getSigningSha1())
                } else {
                    result.notImplemented()
                }
            }
    }

    private fun getSigningSha1(): String? {
        return try {
            val signatures = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                packageManager
                    .getPackageInfo(packageName, PackageManager.GET_SIGNING_CERTIFICATES)
                    .signingInfo
                    ?.apkContentsSigners
            } else {
                @Suppress("DEPRECATION")
                packageManager
                    .getPackageInfo(packageName, PackageManager.GET_SIGNATURES)
                    .signatures
            }
            val bytes = signatures?.firstOrNull()?.toByteArray() ?: return null
            MessageDigest.getInstance("SHA-1").digest(bytes)
                .joinToString(":") { "%02X".format(it) }
        } catch (e: Exception) {
            null
        }
    }
}
