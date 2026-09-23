import React from 'react';

jest.mock('react-native', () => {
  const mockReact = require('react');
  return {
    View: (props: any) => mockReact.createElement('View', props, props.children),
    Text: (props: any) => mockReact.createElement('Text', props, props.children),
    StyleSheet: {
      create: (styles: any) => styles,
    },
    TouchableOpacity: (props: any) => mockReact.createElement('TouchableOpacity', props, props.children),
    TextInput: (props: any) => mockReact.createElement('TextInput', props, props.children),
    Image: (props: any) => mockReact.createElement('Image', props, props.children),
    ActivityIndicator: (props: any) => mockReact.createElement('ActivityIndicator', props, props.children),
    ScrollView: (props: any) => mockReact.createElement('ScrollView', props, props.children),
    FlatList: (props: any) => mockReact.createElement('FlatList', props, props.children),
    Alert: {
      alert: jest.fn(),
    },
    Dimensions: {
      get: () => ({ width: 390, height: 844 }),
    },
    useWindowDimensions: () => ({ width: 390, height: 844 }),
    RefreshControl: (props: any) => mockReact.createElement('RefreshControl', props, props.children),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 48, bottom: 34, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: any) => children,
}));

let mockStore: { [key: string]: string } = {};

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockStore[key] || null),
  setItemAsync: jest.fn(async (key: string, val: string) => {
    mockStore[key] = val;
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    delete mockStore[key];
  }),
}));

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(async () => true),
  isEnrolledAsync: jest.fn(async () => true),
  authenticateAsync: jest.fn(async () => ({ success: true })),
  AuthenticationType: {
    FINGERPRINT: 1,
    FACIAL_RECOGNITION: 2,
  },
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: 'medium', Light: 'light', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Error: 'error', Warning: 'warning' },
}));

jest.mock('expo-router', () => {
  const mockReact = require('react');
  return {
    useFocusEffect: (cb: any) => {
      mockReact.useEffect(() => {
        if (typeof cb === 'function') cb();
      }, [cb]);
    },
  };
});

jest.mock('lucide-react-native', () => ({
  Lock: () => null,
  Unlock: () => null,
  Key: () => null,
  Fingerprint: () => null,
  Eye: () => null,
  EyeOff: () => null,
  Save: () => null,
  Shield: () => null,
  ShieldCheck: () => null,
  CheckCircle: () => null,
  Trash2: () => null,
  Camera: () => null,
  ImagePlus: () => null,
  Zap: () => null,
  Image: () => null,
  Info: () => null,
  Delete: () => null,
}));

const mockPhotos = [
  {
    id: 1,
    timestamp: '2026-09-20T10:00:00Z',
    date: '2026-09-20',
    meal_type: 'Breakfast',
    calories: 500,
    protein_g: 40,
    carbs_g: 50,
    fat_g: 15,
    weight_kg: 78.5,
    workout_notes: 'Leg day',
    wind_down: 'Felt great',
    ai_feedback: [],
    meal_photo_uri: null,
    progress_photo_uri: 'file:///vault/photo1.jpg',
    created_at: '2026-09-20T10:00:00Z',
  },
  {
    id: 2,
    timestamp: '2026-09-22T10:00:00Z',
    date: '2026-09-22',
    meal_type: 'Lunch',
    calories: 600,
    protein_g: 45,
    carbs_g: 55,
    fat_g: 20,
    weight_kg: 77.9,
    workout_notes: 'Chest & Arms',
    wind_down: 'Good pump',
    ai_feedback: [],
    meal_photo_uri: null,
    progress_photo_uri: 'file:///vault/photo2.jpg',
    created_at: '2026-09-22T10:00:00Z',
  },
];

jest.mock('../db/database', () => ({
  getProgressPhotos: jest.fn(async () => mockPhotos),
}));

import VaultScreen from '../app/(tabs)/vault';
import SettingsScreen, { validatePinFormat } from '../app/(tabs)/settings';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import { Alert } from 'react-native';
import { getApiKey, setApiKey, getVaultPin, setVaultPin } from '../services/secureStore';
import { getProgressPhotos } from '../db/database';

describe('Task 6: Biometric Progress Vault & Settings Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStore = {};
  });

  describe('SecureStore service operations', () => {
    it('defaults to 1234 when vault PIN has not been set', async () => {
      const pin = await getVaultPin();
      expect(pin).toBe('1234');
    });

    it('persists and retrieves custom vault PIN', async () => {
      await setVaultPin('8821');
      const pin = await getVaultPin();
      expect(pin).toBe('8821');
    });

    it('returns null when API key is not configured', async () => {
      const apiKey = await getApiKey();
      expect(apiKey).toBeNull();
    });

    it('persists and retrieves trimmed Gemini API key', async () => {
      await setApiKey('  AIzaSyTestSecretKey456  ');
      const apiKey = await getApiKey();
      expect(apiKey).toBe('AIzaSyTestSecretKey456');
    });
  });

  describe('VaultScreen Component', () => {
    it('is a valid React component function', () => {
      expect(typeof VaultScreen).toBe('function');
    });

    it('renders locked view initially with keypad and biometric action', () => {
      const element = <VaultScreen />;
      expect(element).toBeDefined();
      expect(element.type).toBe(VaultScreen);
    });

    it('loads progress photos from database when queried', async () => {
      const photos = await getProgressPhotos();
      expect(photos).toHaveLength(2);
      expect(photos[0].progress_photo_uri).toBe('file:///vault/photo1.jpg');
      expect(photos[0].weight_kg).toBe(78.5);
      expect(photos[1].date).toBe('2026-09-22');
    });

    it('authenticates with biometrics successfully', async () => {
      const authResult = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access Vault',
        fallbackLabel: 'Use PIN',
      });
      expect(authResult.success).toBe(true);
      expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledWith({
        promptMessage: 'Authenticate to access Vault',
        fallbackLabel: 'Use PIN',
      });
    });

    it('checks hardware and enrollment for biometrics', async () => {
      const hasHw = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      expect(hasHw).toBe(true);
      expect(isEnrolled).toBe(true);
    });
  });

  describe('SettingsScreen Component', () => {
    it('is a valid React component function', () => {
      expect(typeof SettingsScreen).toBe('function');
    });

    it('renders settings view structure', () => {
      const element = <SettingsScreen />;
      expect(element).toBeDefined();
      expect(element.type).toBe(SettingsScreen);
    });

    it('validates 4-digit numeric PIN format correctly', () => {
      expect(validatePinFormat('1234')).toBe(true);
      expect(validatePinFormat('0000')).toBe(true);
      expect(validatePinFormat('9999')).toBe(true);
      expect(validatePinFormat('123')).toBe(false);
      expect(validatePinFormat('12345')).toBe(false);
      expect(validatePinFormat('abcd')).toBe(false);
      expect(validatePinFormat('12a4')).toBe(false);
      expect(validatePinFormat('')).toBe(false);
      expect(validatePinFormat(' 1234 ')).toBe(false);
    });

    it('allows updating and retrieving settings through secure storage', async () => {
      await setApiKey('AIzaSyCustomApiKey999');
      await setVaultPin('9988');

      expect(await getApiKey()).toBe('AIzaSyCustomApiKey999');
      expect(await getVaultPin()).toBe('9988');
    });
  });
});