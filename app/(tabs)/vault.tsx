import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';
import { Lock, Fingerprint, Delete, Image as ImageIcon, Scale, Calendar } from 'lucide-react-native';
import { GlassCard } from '../../components/GlassCard';
import { COLORS } from '../../constants/theme';
import { FitnessLogEntry } from '../../types/fitness';
import { getProgressPhotos } from '../../db/database';
import { getVaultPin } from '../../services/secureStore';

const windowWidth = Dimensions?.get ? (Dimensions.get('window')?.width ?? 390) : 390;
const COLUMN_WIDTH = (windowWidth - 48) / 2;

export default function VaultScreen(): JSX.Element {
  const insets = useSafeAreaInsets();
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [storedPin, setStoredPin] = useState('1234');
  const [photos, setPhotos] = useState<FitnessLogEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadStoredPin = useCallback(async () => {
    try {
      const pinValue = await getVaultPin();
      setStoredPin(pinValue);
    } catch {
      setStoredPin('1234');
    }
  }, []);

  const loadPhotos = useCallback(async () => {
    try {
      const data = await getProgressPhotos();
      setPhotos(data);
    } catch {
      setPhotos([]);
    }
  }, []);

  useEffect(() => {
    loadStoredPin();
  }, [loadStoredPin]);

  useFocusEffect(
    useCallback(() => {
      loadStoredPin();
      if (isUnlocked) {
        loadPhotos();
      }
    }, [isUnlocked, loadPhotos, loadStoredPin])
  );

  const unlockVault = async () => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    setIsUnlocked(true);
    setPin('');
    setErrorMessage(null);
    loadPhotos();
  };

  const handleKeyPress = (num: string) => {
    if (pin.length >= 4) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    const newPin = pin + num;
    setPin(newPin);
    setErrorMessage(null);

    if (newPin.length === 4) {
      if (newPin === storedPin) {
        unlockVault();
      } else {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } catch {}
        setErrorMessage('Incorrect PIN. Try again.');
        setTimeout(() => {
          setPin('');
        }, 500);
      }
    }
  };

  const handleDelete = () => {
    if (pin.length === 0) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setPin(pin.slice(0, -1));
    setErrorMessage(null);
  };

  const handleBiometricAuth = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        setErrorMessage('Biometrics not available on this device');
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access Vault',
        fallbackLabel: 'Use PIN',
      });

      if (result.success) {
        unlockVault();
      } else {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } catch {}
      }
    } catch {
      setErrorMessage('Biometric authentication failed');
    }
  };

  const handleLock = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    setIsUnlocked(false);
    setPin('');
    setErrorMessage(null);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPhotos();
    setRefreshing(false);
  };

  const renderPhotoItem = ({ item }: { item: FitnessLogEntry }) => {
    return (
      <GlassCard style={styles.photoCard}>
        {item.progress_photo_uri ? (
          <Image
            source={{ uri: item.progress_photo_uri }}
            style={styles.photoImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.photoPlaceholder}>
            <ImageIcon color={COLORS.textMuted} size={32} />
          </View>
        )}
        <View style={styles.photoMeta}>
          <View style={styles.metaRow}>
            <Calendar color={COLORS.primary} size={12} />
            <Text style={styles.photoDate}>{item.date || 'Unknown Date'}</Text>
          </View>
          {item.weight_kg != null && (
            <View style={styles.metaRow}>
              <Scale color={COLORS.secondary} size={12} />
              <Text style={styles.photoWeight}>{item.weight_kg} kg</Text>
            </View>
          )}
          {item.workout_notes ? (
            <Text style={styles.photoNote} numberOfLines={1}>
              {item.workout_notes}
            </Text>
          ) : null}
        </View>
      </GlassCard>
    );
  };

  if (!isUnlocked) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
        <View style={styles.lockHeader}>
          <View style={styles.lockIconCircle}>
            <Lock color={COLORS.primary} size={32} />
          </View>
          <Text style={styles.lockTitle}>Progress Vault</Text>
          <Text style={styles.lockSubtitle}>Enter PIN or use biometric auth to unlock</Text>
        </View>

        <View style={styles.pinIndicatorContainer}>
          {[0, 1, 2, 3].map((index) => (
            <View
              key={index}
              style={[
                styles.pinDot,
                pin.length > index && styles.pinDotFilled,
                errorMessage && styles.pinDotError,
              ]}
            />
          ))}
        </View>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        <View style={styles.keypad}>
          {[
            ['1', '2', '3'],
            ['4', '5', '6'],
            ['7', '8', '9'],
          ].map((row, rowIndex) => (
            <View key={rowIndex} style={styles.keypadRow}>
              {row.map((digit) => (
                <TouchableOpacity
                  key={digit}
                  style={styles.keypadKey}
                  onPress={() => handleKeyPress(digit)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.keypadKeyText}>{digit}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
          <View style={styles.keypadRow}>
            <TouchableOpacity
              style={styles.keypadKey}
              onPress={handleBiometricAuth}
              activeOpacity={0.7}
            >
              <Fingerprint color={COLORS.primary} size={28} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.keypadKey}
              onPress={() => handleKeyPress('0')}
              activeOpacity={0.7}
            >
              <Text style={styles.keypadKeyText}>0</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.keypadKey}
              onPress={handleDelete}
              activeOpacity={0.7}
            >
              <Delete color={COLORS.textSecondary} size={24} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
      <View style={styles.unlockedHeader}>
        <View>
          <Text style={styles.title}>Progress Vault</Text>
          <Text style={styles.subtitle}>Physique transformation timeline</Text>
        </View>
        <TouchableOpacity
          style={styles.lockButton}
          onPress={handleLock}
          activeOpacity={0.8}
        >
          <Lock color={COLORS.text} size={16} />
          <Text style={styles.lockButtonText}>Lock</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={photos}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderPhotoItem}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.galleryContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <GlassCard style={styles.emptyCard}>
              <ImageIcon color={COLORS.textMuted} size={48} />
              <Text style={styles.emptyTitle}>No Progress Photos</Text>
              <Text style={styles.emptySubtitle}>
                Add progress photos to your daily fitness logs to track your physique transformation over time.
              </Text>
            </GlassCard>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 16,
  },
  lockHeader: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 30,
  },
  lockIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
  },
  lockTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 6,
  },
  lockSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  pinIndicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 20,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: COLORS.textMuted,
    backgroundColor: 'transparent',
  },
  pinDotFilled: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  pinDotError: {
    backgroundColor: COLORS.danger,
    borderColor: COLORS.danger,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  keypad: {
    maxWidth: 280,
    alignSelf: 'center',
    width: '100%',
    marginTop: 'auto',
    marginBottom: 40,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  keypadKey: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keypadKeyText: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: '600',
  },
  unlockedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  lockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  lockButtonText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  galleryContent: {
    paddingBottom: 40,
  },
  photoCard: {
    width: COLUMN_WIDTH,
    padding: 0,
    overflow: 'hidden',
    borderRadius: 14,
  },
  photoImage: {
    width: '100%',
    height: COLUMN_WIDTH * 1.25,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  photoPlaceholder: {
    width: '100%',
    height: COLUMN_WIDTH * 1.25,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  photoMeta: {
    padding: 10,
    gap: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  photoDate: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
  photoWeight: {
    color: COLORS.secondary,
    fontSize: 11,
    fontWeight: '700',
  },
  photoNote: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  emptyContainer: {
    paddingTop: 40,
    alignItems: 'center',
  },
  emptyCard: {
    width: '100%',
    alignItems: 'center',
    padding: 28,
    gap: 12,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
