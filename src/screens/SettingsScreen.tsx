import React from 'react';
import { onTabBarScroll } from '../components/FloatingTabBar';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Switch } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Theme, THEMES } from '../theme/themes';
import { NotificationPrefs, Sensitivity, NotificationKind, KIND_LABELS, defaultPrefs } from '../ml/notificationPrefs';

interface Props {
  mode: 'strict' | 'liberal' | null;
  setMode: (mode: 'strict' | 'liberal') => void;
  resetAppData: () => void;
  userLabels: any[];
  pinnedFeatures: string[];
  togglePin: (id: string) => void;
  currentThemeId: string;
  setTheme: (id: string) => void;
  isBiometricEnabled: boolean;
  setIsBiometricEnabled: (v: boolean) => void;
  theme: Theme;
  notificationPrefs?: NotificationPrefs;
  setNotificationPrefs?: (prefs: NotificationPrefs) => void;
}

export default function SettingsScreen({
  mode, setMode, resetAppData, userLabels, pinnedFeatures, togglePin,
  currentThemeId, setTheme, isBiometricEnabled, setIsBiometricEnabled, theme,
  notificationPrefs = defaultPrefs(), setNotificationPrefs
}: Props) {
  const C = theme;

  const handleClearData = () => {
    Alert.alert(
      "Clear App Data",
      "Are you sure you want to wipe your local ML model and settings? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Clear", style: "destructive", onPress: () => resetAppData() }
      ]
    );
  };

  const updatePrefs = (updater: (prev: NotificationPrefs) => NotificationPrefs) => {
    if (setNotificationPrefs) {
      setNotificationPrefs(updater(notificationPrefs));
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: C.bg }]} contentContainerStyle={{ paddingBottom: 150 }} onScroll={onTabBarScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false}>
      <Text style={[styles.headerTitle, { color: C.textPrimary }]}>Settings</Text>

      {/* Prestige Themes Card */}
      <View style={[styles.glassCard, { padding: 20, marginBottom: 16, borderColor: C.border }]}>
        <Text style={[styles.cardHeaderTitle, { color: C.textSecondary }]}>PRESTIGE THEMES</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
          {Object.values(THEMES).map(t => (
            <TouchableOpacity
                key={t.id}
                onPress={() => setTheme(t.id)}
                style={[
                    styles.themeChip,
                    { borderColor: currentThemeId === t.id ? t.accent : t.border },
                    currentThemeId === t.id && { borderWidth: 2, backgroundColor: 'rgba(255,255,255,0.1)' }
                ]}
            >
              <View style={[styles.themeDot, { backgroundColor: t.accent }]} />
              <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>{t.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ML Notification Brain Controls */}
      <View style={[styles.glassCard, { padding: 20, marginBottom: 16, borderColor: C.border }]}>
        <Text style={[styles.cardHeaderTitle, { color: C.textSecondary }]}>ML NOTIFICATION BRAIN</Text>
        <Text style={[styles.subtext, { color: C.textSecondary }]}>Configure proactive risk window heads-ups, sensitivity, and quiet hours.</Text>

        <View style={styles.settingRow}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ color: C.textPrimary, fontSize: 14, fontWeight: '700' }}>Enable Proactive Alerts</Text>
            <Text style={{ color: C.textSecondary, fontSize: 11, marginTop: 2 }}>Allow Q to predict peak spending hours</Text>
          </View>
          <Switch
            value={notificationPrefs.enabled}
            onValueChange={v => updatePrefs(p => ({ ...p, enabled: v }))}
            trackColor={{ false: '#333', true: C.accent }}
            thumbColor={notificationPrefs.enabled ? '#FFF' : '#AAA'}
          />
        </View>

        {notificationPrefs.enabled && (
          <>
            <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 12 }}>
              <Text style={{ color: C.textPrimary, fontSize: 13, fontWeight: '700', marginBottom: 10 }}>Alert Types</Text>
              {(Object.keys(KIND_LABELS) as NotificationKind[]).map(kind => (
                <View key={kind} style={styles.subSettingRow}>
                  <Text style={{ color: C.textSecondary, fontSize: 12, flex: 1 }}>{KIND_LABELS[kind]}</Text>
                  <Switch
                    value={notificationPrefs.kinds[kind]}
                    onValueChange={v => updatePrefs(p => ({ ...p, kinds: { ...p.kinds, [kind]: v } }))}
                    trackColor={{ false: '#333', true: C.accent }}
                    thumbColor={notificationPrefs.kinds[kind] ? '#FFF' : '#AAA'}
                  />
                </View>
              ))}
            </View>

            <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 12 }}>
              <Text style={{ color: C.textPrimary, fontSize: 13, fontWeight: '700', marginBottom: 6 }}>Model Sensitivity</Text>
              <Text style={{ color: C.textSecondary, fontSize: 11, marginBottom: 10 }}>Controls how confident Q must be before speaking up.</Text>

              <View style={styles.modeRow}>
                {(['low', 'normal', 'high'] as Sensitivity[]).map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.modeButton, notificationPrefs.sensitivity === s && { backgroundColor: C.accent }]}
                    onPress={() => updatePrefs(p => ({ ...p, sensitivity: s }))}
                  >
                    <Text style={[styles.modeButtonText, { color: notificationPrefs.sensitivity === s ? '#FFFFFF' : C.textSecondary }]}>
                      {s.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 12 }}>
              <Text style={{ color: C.textPrimary, fontSize: 13, fontWeight: '700', marginBottom: 4 }}>Quiet Hours</Text>
              <Text style={{ color: C.textSecondary, fontSize: 11 }}>
                Currently set to {notificationPrefs.quiet.startHour}:00 - {notificationPrefs.quiet.endHour}:00. No notifications will fire during these hours.
              </Text>
            </View>
          </>
        )}
      </View>

      {/* Security Card */}
      <View style={[styles.glassCard, { padding: 20, marginBottom: 16, borderColor: C.border }]}>
        <Text style={[styles.cardHeaderTitle, { color: C.textSecondary }]}>ELITE SECURITY</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <View style={{ flex: 1, marginRight: 16 }}>
                <Text style={{ color: C.textPrimary, fontSize: 15, fontWeight: '700' }}>Biometric Privacy Lock</Text>
                <Text style={{ color: C.textSecondary, fontSize: 12, marginTop: 4 }}>Require Fingerprint/FaceID to unlock app</Text>
            </View>
            <Switch
                value={isBiometricEnabled}
                onValueChange={setIsBiometricEnabled}
                trackColor={{ false: '#333', true: C.accent }}
                thumbColor={isBiometricEnabled ? '#FFF' : '#AAA'}
            />
        </View>
      </View>

      {/* Profile Card */}
      <View style={[styles.glassCard, { padding: 20, marginBottom: 16, borderColor: C.border }]}>
        <Text style={[styles.cardHeaderTitle, { color: C.textSecondary }]}>PROFILE</Text>
        <View style={styles.profileRow}>
          <View style={[styles.avatarBox, { borderColor: C.accent, backgroundColor: `${C.accent}18` }]}>
            <Text style={[styles.avatarText, { color: C.accent }]}>Q</Text>
          </View>
          <View>
            <Text style={[styles.profileName, { color: C.textPrimary }]}>Q User</Text>
            <Text style={[styles.profileMeta, { color: C.textSecondary }]}>{userLabels.length} ML decisions logged</Text>
          </View>
        </View>
      </View>

      {/* Scoring Mode Card */}
      <View style={[styles.glassCard, { padding: 20, marginBottom: 16, borderColor: C.border }]}>
        <Text style={[styles.cardHeaderTitle, { color: C.textSecondary }]}>SCORING MODE</Text>
        <Text style={[styles.subtext, { color: C.textSecondary }]}>Switch between judgmental and forgiving behavioral analysis.</Text>

        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'strict' && { backgroundColor: C.accent }]}
            onPress={() => setMode('strict')}
          >
            <Icon name="scale-balance" size={16} color={mode === 'strict' ? '#FFFFFF' : C.textSecondary} style={{ marginRight: 6 }} />
            <Text style={[styles.modeButtonText, { color: mode === 'strict' ? '#FFFFFF' : C.textSecondary }]}>Strict</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeButton, mode === 'liberal' && { backgroundColor: C.accent }]}
            onPress={() => setMode('liberal')}
          >
            <Icon name="heart-outline" size={16} color={mode === 'liberal' ? '#FFFFFF' : C.textSecondary} style={{ marginRight: 6 }} />
            <Text style={[styles.modeButtonText, { color: mode === 'liberal' ? '#FFFFFF' : C.textSecondary }]}>Liberal</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Customize Dashboard Card */}
      <View style={[styles.glassCard, { padding: 20, marginBottom: 16, borderColor: C.border }]}>
        <Text style={[styles.cardHeaderTitle, { color: C.textSecondary }]}>CUSTOMIZE DASHBOARD</Text>
        <Text style={[styles.subtext, { color: C.textSecondary }]}>Pin or unpin features to keep your focus sharp.</Text>

        <View style={{ gap: 10 }}>
          {[
            { id: 'wellness', name: 'Wellness Score' },
            { id: 'persona', name: 'Financial Persona' },
            { id: 'streaks', name: 'Discipline Streaks' },
            { id: 'vault', name: '24-Hour Rule' },
            { id: 'heatmap', name: 'Behavior Map' },
            { id: 'subs', name: 'Subscription Audit' },
            { id: 'repetitive', name: 'Repetitive Payments' },
            { id: 'feed', name: 'AI Behavior Feed' },
            { id: 'forecast', name: 'Spend Forecast' },
            { id: 'goals', name: 'Savings Vault' },
            { id: 'chart', name: 'Weekly Chart' }
          ].map(feature => (
            <TouchableOpacity
              key={feature.id}
              style={styles.pinRow}
              onPress={() => togglePin(feature.id)}
            >
              <Text style={{ color: pinnedFeatures.includes(feature.id) ? C.textPrimary : C.textSecondary, fontSize: 13, fontWeight: '600' }}>
                {feature.name}
              </Text>
              <Icon
                name={pinnedFeatures.includes(feature.id) ? "pin" : "pin-off-outline"}
                size={18}
                color={pinnedFeatures.includes(feature.id) ? C.accent : C.textSecondary}
              />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Data Management Card */}
      <View style={[styles.glassCard, { padding: 20, borderColor: C.border }]}>
        <Text style={[styles.cardHeaderTitle, { color: C.textSecondary }]}>DATA & PRIVACY</Text>
        <Text style={[styles.subtext, { color: C.textSecondary }]}>Your SMS data is parsed locally on your device. Cloud sync only stores parsed amounts and merchants.</Text>

        <TouchableOpacity style={styles.dangerButton} onPress={handleClearData}>
          <Icon name="trash-can-outline" size={16} color={C.danger} style={{ marginRight: 8 }} />
          <Text style={[styles.dangerButtonText, { color: C.danger }]}>Clear Local App Data</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerTitle: { fontSize: 28, fontWeight: '800', marginBottom: 24, letterSpacing: -0.5, marginTop: 20 },
  glassCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderRadius: 24,
  },
  cardHeaderTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 16, textTransform: 'uppercase' },
  subtext: { fontSize: 12, marginBottom: 16, lineHeight: 18 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  subSettingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  profileRow: { flexDirection: 'row', alignItems: 'center' },
  avatarBox: { width: 44, height: 44, borderRadius: 12, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontSize: 18, fontWeight: 'bold' },
  profileName: { fontSize: 16, fontWeight: '600' },
  profileMeta: { fontSize: 12, marginTop: 2 },
  modeRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 4 },
  modeButton: { flex: 1, flexDirection: 'row', paddingVertical: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  modeButtonText: { fontSize: 12, fontWeight: '700' },
  pinRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  dangerButton: { backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  dangerButtonText: { fontSize: 14, fontWeight: 'bold' },
  themeChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, marginRight: 10, backgroundColor: 'rgba(255,255,255,0.05)' },
  themeDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 }
});
