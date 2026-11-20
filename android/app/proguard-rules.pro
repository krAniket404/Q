# CentiQ Security & Obfuscation ProGuard Rules

# React Native Core
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }

# Android Biometrics & Cryptography
-keep class androidx.biometric.** { *; }
-keep class javax.crypto.** { *; }
-keep class java.security.** { *; }

# Firebase & Google Services
-keep class com.google.firebase.** { *; }

# Keep Custom Native Modules
-keep class com.centiq.** { *; }

# Suppress warnings
-dontwarn javax.annotation.**
