package com.centiq

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import android.provider.Telephony
import com.facebook.react.bridge.*
import androidx.core.content.ContextCompat
import android.content.Intent
import android.app.PendingIntent
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import android.view.WindowManager
import androidx.biometric.BiometricPrompt
import androidx.biometric.BiometricManager
import androidx.fragment.app.FragmentActivity
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class SmsModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private val KEY_ALIAS = "centiq_master_key"
    private val ANDROID_KEYSTORE = "AndroidKeyStore"
    private val CIPHER_TRANSFORMATION = "AES/GCM/NoPadding"
    private val ENC_PREFIX = "ENC:"

    override fun getName(): String = "SmsModule"

    @ReactMethod
    fun hasPermission(promise: Promise) {
        val granted = ContextCompat.checkSelfPermission(reactApplicationContext, Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED
        promise.resolve(granted)
    }

    override fun initialize() {
        super.initialize()
        ReactContextSingleton.reactContext = reactApplicationContext
    }

    private fun getOrCreateSecretKey(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE)
        keyStore.load(null)
        if (!keyStore.containsAlias(KEY_ALIAS)) {
            val keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
            val keyGenSpec = KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build()
            keyGenerator.init(keyGenSpec)
            return keyGenerator.generateKey()
        }
        val entry = keyStore.getEntry(KEY_ALIAS, null) as KeyStore.SecretKeyEntry
        return entry.secretKey
    }

    private fun encryptData(plainText: String): String {
        val secretKey = getOrCreateSecretKey()
        val cipher = Cipher.getInstance(CIPHER_TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, secretKey)
        val iv = cipher.iv
        val encryptedBytes = cipher.doFinal(plainText.toByteArray(Charsets.UTF_8))
        val combined = ByteArray(iv.size + encryptedBytes.size)
        System.arraycopy(iv, 0, combined, 0, iv.size)
        System.arraycopy(encryptedBytes, 0, combined, iv.size, encryptedBytes.size)
        return ENC_PREFIX + Base64.encodeToString(combined, Base64.NO_WRAP)
    }

    private fun decryptData(cipherText: String): String {
        if (!cipherText.startsWith(ENC_PREFIX)) {
            // Legacy unencrypted data fallback
            return cipherText
        }
        val rawBase64 = cipherText.substring(ENC_PREFIX.length)
        val combined = Base64.decode(rawBase64, Base64.NO_WRAP)
        val ivSize = 12 // GCM Standard IV size
        if (combined.size <= ivSize) return cipherText

        val iv = ByteArray(ivSize)
        val encryptedBytes = ByteArray(combined.size - ivSize)
        System.arraycopy(combined, 0, iv, 0, ivSize)
        System.arraycopy(combined, ivSize, encryptedBytes, 0, encryptedBytes.size)

        val secretKey = getOrCreateSecretKey()
        val cipher = Cipher.getInstance(CIPHER_TRANSFORMATION)
        cipher.init(Cipher.DECRYPT_MODE, secretKey, GCMParameterSpec(128, iv))
        val decryptedBytes = cipher.doFinal(encryptedBytes)
        return String(decryptedBytes, Charsets.UTF_8)
    }

    @ReactMethod
    fun readBankSMS(promise: Promise) {
        val smsList = Arguments.createArray()
        val cursor: Cursor? = reactApplicationContext.contentResolver.query(
            Telephony.Sms.CONTENT_URI,
            arrayOf(Telephony.Sms.ADDRESS, Telephony.Sms.BODY, Telephony.Sms.DATE),
            null, null, Telephony.Sms.DATE + " DESC"
        )

        cursor?.use {
            if (it.moveToFirst()) {
                do {
                    val address = it.getString(it.getColumnIndexOrThrow(Telephony.Sms.ADDRESS))
                    val body = it.getString(it.getColumnIndexOrThrow(Telephony.Sms.BODY))
                    val date = it.getLong(it.getColumnIndexOrThrow(Telephony.Sms.DATE))

                    val smsMap = Arguments.createMap()
                    smsMap.putString("address", address)
                    smsMap.putString("body", body)
                    smsMap.putDouble("date", date.toDouble())
                    smsList.pushMap(smsMap)
                } while (it.moveToNext() && smsList.size() < 1000)
            }
        }
        promise.resolve(smsList)
    }

    @ReactMethod
    fun saveData(key: String, value: String, promise: Promise) {
        try {
            val encryptedValue = encryptData(value)
            val prefs = reactApplicationContext.getSharedPreferences("centiq_prefs", Context.MODE_PRIVATE)
            val success = prefs.edit().putString(key, encryptedValue).commit()
            if (success) {
                promise.resolve(true)
            } else {
                promise.reject("SAVE_FAILED", "Failed to commit to encrypted storage")
            }
        } catch (e: Exception) {
            promise.reject("SAVE_ERROR", e)
        }
    }

    @ReactMethod
    fun loadData(key: String, promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences("centiq_prefs", Context.MODE_PRIVATE)
            val rawData = prefs.getString(key, null)
            if (rawData == null) {
                promise.resolve(null)
            } else {
                val decrypted = decryptData(rawData)
                promise.resolve(decrypted)
            }
        } catch (e: Exception) {
            promise.reject("LOAD_ERROR", e)
        }
    }

    @ReactMethod
    fun setScreenSecurity(enable: Boolean, promise: Promise) {
        try {
            val activity = currentActivity
            if (activity != null) {
                activity.runOnUiThread {
                    if (enable) {
                        activity.window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
                    } else {
                        activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
                    }
                    promise.resolve(true)
                }
            } else {
                promise.resolve(false)
            }
        } catch (e: Exception) {
            promise.reject("SECURITY_ERROR", e)
        }
    }

    @ReactMethod
    fun openNotificationSettings(promise: Promise) {
        try {
            val intent = Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS")
            getCurrentActivity()?.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SETTINGS_ERROR", e)
        }
    }

    @ReactMethod
    fun isNotificationServiceEnabled(promise: Promise) {
        val pkgName = reactApplicationContext.packageName
        val flat = android.provider.Settings.Secure.getString(reactApplicationContext.contentResolver, "enabled_notification_listeners")
        val enabled = flat != null && flat.contains(pkgName)
        promise.resolve(enabled)
    }

    @ReactMethod
    fun getPendingNotifLabel(promise: Promise) {
        val prefs = reactApplicationContext.getSharedPreferences("centiq_prefs", Context.MODE_PRIVATE)
        val status = prefs.getString("pending_notif_label", null)
        val result = Arguments.createMap()
        if (status != null) {
            result.putString("status", "found")
            result.putBoolean("isImpulsive", status == "impulsive")
            prefs.edit().remove("pending_notif_label").apply()
        } else {
            result.putString("status", "not_found")
        }
        promise.resolve(result)
    }

    @ReactMethod
    fun scheduleRepeatingNotification(id: String, hours: Float, title: String, message: String, promise: Promise) {
        try {
            val context = reactApplicationContext
            val intent = Intent(context, DailyReminderReceiver::class.java).apply {
                putExtra("title", title)
                putExtra("message", message)
            }
            val pendingIntent = PendingIntent.getBroadcast(
                context, id.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as android.app.AlarmManager
            val interval = (hours * 3600 * 1000).toLong()
            alarmManager.setRepeating(
                android.app.AlarmManager.RTC_WAKEUP,
                System.currentTimeMillis() + interval,
                interval,
                pendingIntent
            )
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("NOTIF_ERROR", e)
        }
    }

    @ReactMethod
    fun scheduleDailyReminder(hour: Int, minute: Int, title: String, message: String, promise: Promise) {
        try {
            val context = reactApplicationContext
            val intent = Intent(context, DailyReminderReceiver::class.java).apply {
                putExtra("title", title)
                putExtra("message", message)
            }
            val pendingIntent = PendingIntent.getBroadcast(
                context, 999, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as android.app.AlarmManager
            val calendar = java.util.Calendar.getInstance().apply {
                set(java.util.Calendar.HOUR_OF_DAY, hour)
                set(java.util.Calendar.MINUTE, minute)
                set(java.util.Calendar.SECOND, 0)
                if (before(java.util.Calendar.getInstance())) {
                    add(java.util.Calendar.DATE, 1)
                }
            }
            alarmManager.setExactAndAllowWhileIdle(
                android.app.AlarmManager.RTC_WAKEUP,
                calendar.timeInMillis,
                pendingIntent
            )
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("REMINDER_ERROR", e)
        }
    }

    @ReactMethod
    fun showNotification(title: String, message: String, promise: Promise) {
        try {
            val context = reactApplicationContext
            val intent = Intent(context, DailyReminderReceiver::class.java).apply {
                putExtra("title", title)
                putExtra("message", message)
            }
            context.sendBroadcast(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("NOTIF_ERROR", e)
        }
    }

    @ReactMethod
    fun cancelNotification(id: String, promise: Promise) {
        try {
            val context = reactApplicationContext
            val intent = Intent(context, DailyReminderReceiver::class.java)
            val pendingIntent = PendingIntent.getBroadcast(
                context, id.hashCode(), intent, PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
            )
            if (pendingIntent != null) {
                val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as android.app.AlarmManager
                alarmManager.cancel(pendingIntent)
                pendingIntent.cancel()
            }
            promise.resolve("Cancelled")
        } catch (e: Exception) {
            promise.reject("CANCEL_ERROR", e)
        }
    }

    @ReactMethod
    fun authenticateUser(promise: Promise) {
        val activity = getCurrentActivity() as? FragmentActivity
        if (activity == null) {
            promise.reject("AUTH_ERROR", "Activity is null or not a FragmentActivity")
            return
        }

        val executor = ContextCompat.getMainExecutor(activity)
        val biometricPrompt = BiometricPrompt(activity, executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    super.onAuthenticationSucceeded(result)
                    promise.resolve(true)
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    super.onAuthenticationError(errorCode, errString)
                    promise.reject("AUTH_ERROR", errString.toString())
                }

                override fun onAuthenticationFailed() {
                    super.onAuthenticationFailed()
                }
            })

        val promptInfoBuilder = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Unlock Q")
            .setSubtitle("Secure your financial data")
            .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL)

        val promptInfo = promptInfoBuilder.build()

        activity.runOnUiThread {
            biometricPrompt.authenticate(promptInfo)
        }
    }
}
