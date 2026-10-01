import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { signIn, signUp } from '../lib/firebase';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const getFriendlyErrorMessage = (e: any): string => {
    if (!e) return "An unexpected error occurred.";
    const code = e.code || e.status || "";
    const msg = e.message || e.error_description || "";

    if (msg.includes("Invalid login credentials") || code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
      return "Incorrect email or password. If you don't have an account yet, tap 'Sign Up' below!";
    }
    if (msg.includes("User already registered") || code === 'auth/email-already-in-use') {
      return "An account with this email already exists. Try logging in!";
    }
    if (msg.includes("Password should be at least") || code === 'auth/weak-password') {
      return "Password should be at least 6 characters long.";
    }
    if (code === 'auth/invalid-email') {
      return "Please enter a valid email address.";
    }
    if (code === 'auth/user-not-found') {
      return "No account found with this email address. Try signing up!";
    }
    if (code === 'auth/network-request-failed') {
      return "Network request failed. Please check your internet connection.";
    }

    return msg || "Authentication failed. Please try again.";
  };

  const handleAuth = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Error", "Please enter email and password");
      return;
    }
    setLoading(true);
    try {
      if (isSignUp) {
        const result: any = await signUp(email.trim(), password);
        if (result?.requiresConfirmation) {
          Alert.alert(
            "Account Created! 📧",
            "Please check your email inbox to confirm your account, or log in now.",
            [{ text: "OK", onPress: () => setIsSignUp(false) }]
          );
        } else {
          Alert.alert("Welcome! 🎉", "Account created successfully!");
        }
      } else {
        await signIn(email.trim(), password);
      }
    } catch (e: any) {
      console.log("Auth Message:", e?.message || e?.code);
      Alert.alert(isSignUp ? "Sign Up Error" : "Login Error", getFriendlyErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Text style={styles.logoText}>Q</Text>
      </View>
      <Text style={styles.title}>CentiQ</Text>
      <Text style={styles.subtitle}>Understand why you spend, not just where.</Text>

      {/* Log In / Sign Up Mode Switcher */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, !isSignUp && styles.activeTab]}
          onPress={() => setIsSignUp(false)}
        >
          <Text style={[styles.tabText, !isSignUp && styles.activeTabText]}>Log In</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, isSignUp && styles.activeTab]}
          onPress={() => setIsSignUp(true)}
        >
          <Text style={[styles.tabText, isSignUp && styles.activeTabText]}>Sign Up</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#888"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#888"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity style={styles.button} onPress={handleAuth} disabled={loading}>
        {loading ? <ActivityIndicator color="#FFF" /> : (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Icon name={isSignUp ? "account-plus" : "login"} size={20} color="#FFF" style={{ marginRight: 8 }} />
            <Text style={styles.buttonText}>{isSignUp ? "Create Account" : "Log In"}</Text>
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.linkButton} onPress={() => setIsSignUp(!isSignUp)} disabled={loading}>
        <Text style={styles.linkText}>
          {isSignUp ? "Already have an account? Log In" : "Don't have an account? Sign Up"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060608', justifyContent: 'center', alignItems: 'center', padding: 20 },
  logoContainer: { width: 100, height: 100, borderRadius: 30, backgroundColor: 'rgba(56,189,248,0.1)', borderWidth: 2, borderColor: '#38BDF8', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  logoText: { fontSize: 50, fontWeight: '900', color: '#38BDF8' },
  title: { fontSize: 32, fontWeight: '900', color: '#FFFFFF', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#A0A0B0', marginBottom: 24, textAlign: 'center' },
  tabContainer: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 4, marginBottom: 20, width: '100%' },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  activeTab: { backgroundColor: '#38BDF8' },
  tabText: { color: '#888', fontWeight: '700', fontSize: 14 },
  activeTabText: { color: '#FFFFFF', fontWeight: '800' },
  input: { width: '100%', height: 50, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, paddingHorizontal: 16, color: '#FFF', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  button: { width: '100%', height: 55, backgroundColor: '#38BDF8', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 16, marginTop: 10 },
  buttonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  linkButton: { padding: 10 },
  linkText: { color: '#A0A0B0', fontSize: 14 }
});
