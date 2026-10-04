import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';
import { Lock, Fingerprint, Image as ImageIcon, Scale, Calendar, ShieldCheck } from 'lucide-react-native';
import { GlassCard } from '../../components/GlassCard';
import { COLORS } from '../../constants/theme';
import { FitnessLogEntry } from '../../types/fitness';
import { getProgressPhotos } from '../../db/database';

export default function VaultScreen(): JSX.Element {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const columnWidth = (width - 52) / 2;

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [photos, setPhotos] = useState<FitnessLogEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [biometricType, setBiometricType] = useState<'fingerprint' | 'facial' | 'biometric' | 'none'>('none');
  const [hasBiometrics, setHasBiometrics] = useState(false);

  const autoPromptRef = useRef(false);

  const checkBiometrics = useCallback(async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (hasHardware && isEnrolled) {
        setHasBiometrics(true);
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setBiometricType('fingerprint');
        } else if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType('facial');
        } else {
          setBiometricType('biometric');
        }
      } else {
        setHasBiometrics(false);
        setBiometricType('none');
      }
    } catch {
      setHasBiometrics(false);
      setBiometricType('none');
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
    checkBiometrics();
  }, [checkBiometrics]);

  const handleBiometricAuth = useCallback(async () => {
    try {
      const promptLabel =
        biometricType === 'fingerprint'
          ? 'Unlock Progress Vault with Fingerprint'
          : biometricType === 'facial'
          ? 'Unlock Progress Vault with Face ID'
          : 'Unlock Progress Vault';

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: promptLabel,
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use Device Passcode',
        disableDeviceFallback: false,
      });

      if (result.success) {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
        setIsUnlocked(true);
        setErrorMessage(null);
        loadPhotos();
      } else {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } catch {}
        setErrorMessage('Authentication canceled or not recognized.');
      }
    } catch {
      setErrorMessage('Biometric authentication failed. Tap below to retry.');
    }
  }, [biometricType, loadPhotos]);

  useFocusEffect(
    useCallback(() => {
      checkBiometrics();
      if (isUnlocked) {
        loadPhotos();
      } else if (!autoPromptRef.current) {
        autoPromptRef.current = true;
        LocalAuthentication.isEnrolledAsync()
          .then((enrolled) => {
            if (enrolled) {
              handleBiometricAuth();
            }
          })
          .catch(() => {});
      }
    }, [isUnlocked, loadPhotos, checkBiometrics, handleBiometricAuth])
  );

  const handleLock = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    setIsUnlocked(false);
    setErrorMessage(null);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPhotos();
    setRefreshing(false);
  };

  const getSubtitleText = () => {
    if (biometricType === 'fingerprint') {
      return 'Secured with Fingerprint Biometrics';
    }
    if (biometricType === 'facial') {
      return 'Secured with Face ID Biometrics';
    }
    if (hasBiometrics) {
      return 'Secured with Phone Biometrics';
    }
    return 'Secured by Phone Device Lock';
  };

  const renderPhotoItem = ({ item }: { item: FitnessLogEntry }) => {
    return (
      <GlassCard style={[styles.photoCard, { width: columnWidth }]}>
        {item.progress_photo_uri ? (
          <Image
            source={{ uri: item.progress_photo_uri }}
            style={[styles.photoImage, { height: columnWidth * 1.25 }]}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.photoPlaceholder, { height: columnWidth * 1.25 }]}>
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
      <View style={[styles.container, { paddingTop: insets.top + 40 }]}>
        <View style={styles.lockCenterContainer}>
          <View style={styles.lockIconCircle}>
            <Lock color={COLORS.primary} size={38} />
          </View>
          <Text style={styles.lockTitle}>Progress Vault</Text>
          <Text style={styles.lockSubtitle}>{getSubtitleText()}</Text>

          <GlassCard style={styles.securityInfoCard}>
            <View style={styles.securityRow}>
              <ShieldCheck color={COLORS.success} size={22} />
              <View style={styles.securityTextContainer}>
                <Text style={styles.securityHeading}>Hardware Keychain Guard</Text>
                <Text style={styles.securityDescription}>
                  Your physique photos are locked on-device and unlocked using your phone's native biometrics.
                </Text>
              </View>
            </View>
          </GlassCard>

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <TouchableOpacity
            testID="quick-biometric-btn"
            style={styles.primaryBiometricButton}
            onPress={handleBiometricAuth}
            activeOpacity={0.85}
          >
            <Fingerprint color="#000" size={26} />
            <Text style={styles.primaryBiometricText}>
              {biometricType === 'fingerprint'
                ? 'Scan Fingerprint to Unlock'
                : biometricType === 'facial'
                ? 'Use Face ID to Unlock'
                : 'Unlock with Phone Biometrics'}
            </Text>
          </TouchableOpacity>
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
        keyExtractor={toStringId}
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
                Add progress photos in Fuel Coach chat to track your physique transformation over time.
              </Text>
            </GlassCard>
          </View>
        }
      />
    </View>
  );
}

function toStringId(item: FitnessLogEntry): string {
  return String(item.id);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 16,
  },
  lockCenterContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    marginTop: 40,
  },
  lockIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(6, 182, 212, 0.35)',
  },
  lockTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 6,
  },
  lockSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  securityInfoCard: {
    width: '100%',
    padding: 16,
    marginBottom: 32,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  securityTextContainer: {
    flex: 1,
  },
  securityHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  securityDescription: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  primaryBiometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    width: '100%',
    gap: 12,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBiometricText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '500',
  },
  unlockedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
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
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  lockButtonText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
  galleryContent: {
    paddingBottom: 40,
  },
  columnWrapper: {
    gap: 12,
    marginBottom: 12,
  },
  photoCard: {
    padding: 8,
    borderRadius: 16,
  },
  photoImage: {
    width: '100%',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  photoPlaceholder: {
    width: '100%',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoMeta: {
    marginTop: 8,
    gap: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  photoDate: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '500',
  },
  photoWeight: {
    color: COLORS.secondary,
    fontSize: 11,
    fontWeight: '600',
  },
  photoNote: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  emptyContainer: {
    marginTop: 60,
    alignItems: 'center',
  },
  emptyCard: {
    alignItems: 'center',
    padding: 32,
    width: '100%',
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
});
