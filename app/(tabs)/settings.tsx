import React, { useState, useEffect, useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  Key,
  Shield,
  Eye,
  EyeOff,
  Save,
  CheckCircle,
  Zap,
} from 'lucide-react-native';
import { GlassCard } from '../../components/GlassCard';
import { COLORS } from '../../constants/theme';
import {
  getApiKey,
  setApiKey,
  getVaultPin,
  setVaultPin,
} from '../../services/secureStore';

export function validatePinFormat(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

export default function SettingsScreen(): JSX.Element {
  const insets = useSafeAreaInsets();
  const [apiKey, setApiKeyState] = useState('');
  const [vaultPin, setVaultPinState] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [savingPin, setSavingPin] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const storedKey = await getApiKey();
      if (storedKey) setApiKeyState(storedKey);

      const storedPin = await getVaultPin();
      if (storedPin) setVaultPinState(storedPin);
    } catch {
      // Retain existing state
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [loadSettings])
  );

  const handleSaveApiKey = async () => {
    setSavingKey(true);
    try {
      await setApiKey(apiKey);
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      Alert.alert('Success', 'Google Gemini API Key saved securely on-device.');
    } catch (error) {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
      Alert.alert('Error', 'Failed to save API key.');
    } finally {
      setSavingKey(false);
    }
  };

  const handleSavePin = async () => {
    if (!validatePinFormat(vaultPin)) {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
      Alert.alert('Invalid PIN', 'PIN must be exactly 4 numeric digits (e.g. 1234).');
      return;
    }

    setSavingPin(true);
    try {
      await setVaultPin(vaultPin);
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      Alert.alert('Success', 'Progress Vault PIN updated successfully.');
    } catch (error) {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
      Alert.alert('Error', 'Failed to update PIN.');
    } finally {
      setSavingPin(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 10 }]}
    >
      <Text style={styles.title}>Security & Settings</Text>
      <Text style={styles.subtitle}>Security, keys & device preferences</Text>

      <GlassCard style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.iconContainer}>
            <Key color={COLORS.primary} size={20} />
          </View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle}>Google Gemini API Key</Text>
            <Text style={styles.cardDescription}>
              Required for automated AI meal macro analysis & coaching insights
            </Text>
          </View>
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            testID="api-key-input"
            style={styles.input}
            value={apiKey}
            onChangeText={setApiKeyState}
            placeholder="Enter Gemini API key"
            placeholderTextColor={COLORS.textMuted}
            secureTextEntry={!showApiKey}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={styles.visibilityButton}
            onPress={() => setShowApiKey(!showApiKey)}
          >
            {showApiKey ? (
              <EyeOff color={COLORS.textSecondary} size={20} />
            ) : (
              <Eye color={COLORS.textSecondary} size={20} />
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          testID="save-api-key-btn"
          style={styles.saveButton}
          onPress={handleSaveApiKey}
          disabled={savingKey}
        >
          <Save color="#000" size={18} />
          <Text style={styles.saveButtonText}>
            {savingKey ? 'Saving...' : 'Save API Key'}
          </Text>
        </TouchableOpacity>
      </GlassCard>

      <GlassCard style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.iconContainer}>
            <Shield color={COLORS.secondary} size={20} />
          </View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle}>Vault Security PIN</Text>
            <Text style={styles.cardDescription}>
              4-digit passcode protecting your private progress photos
            </Text>
          </View>
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            testID="pin-input"
            style={[styles.input, styles.pinInput]}
            value={vaultPin}
            onChangeText={setVaultPinState}
            placeholder="1234"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="number-pad"
            maxLength={4}
            secureTextEntry={false}
          />
        </View>

        <TouchableOpacity
          testID="save-pin-btn"
          style={[styles.saveButton, styles.secondarySaveButton]}
          onPress={handleSavePin}
          disabled={savingPin}
        >
          <Save color="#FFF" size={18} />
          <Text style={[styles.saveButtonText, { color: '#FFF' }]}>
            {savingPin ? 'Updating...' : 'Update Vault PIN'}
          </Text>
        </TouchableOpacity>
      </GlassCard>

      <GlassCard style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconContainer, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
            <CheckCircle color={COLORS.success} size={20} />
          </View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle}>Privacy & Storage Architecture</Text>
            <Text style={styles.privacyBadge}>100% ON-DEVICE DATA</Text>
          </View>
        </View>
        <Text style={styles.privacyText}>
          Fuel operates with zero cloud database backend. Your logs, photos, and API keys are stored solely on your local device filesystem and encrypted hardware keychain.
        </Text>
      </GlassCard>

      <GlassCard style={[styles.card, styles.aboutCard]}>
        <View style={styles.aboutRow}>
          <Zap color={COLORS.primary} size={18} />
          <Text style={styles.aboutTitle}>Fuel Fitness Tracker</Text>
          <Text style={styles.aboutVersion}>v1.0.0</Text>
        </View>
      </GlassCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 20,
    paddingBottom: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 20,
  },
  card: {
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    marginBottom: 14,
    gap: 12,
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  cardDescription: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 12,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    height: 44,
    color: COLORS.text,
    fontSize: 14,
  },
  pinInput: {
    fontSize: 18,
    letterSpacing: 6,
    fontWeight: '700',
  },
  visibilityButton: {
    padding: 6,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 10,
  },
  secondarySaveButton: {
    backgroundColor: COLORS.secondary,
  },
  saveButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '700',
  },
  privacyBadge: {
    color: COLORS.success,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  privacyText: {
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  aboutCard: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aboutTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  aboutVersion: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
});
