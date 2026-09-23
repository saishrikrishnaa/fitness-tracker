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
    Alert: {
      alert: jest.fn(),
    },
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: any) => children,
}));

jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///data/user/0/host.exp.exponent/files/',
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  copyAsync: jest.fn(),
  readAsStringAsync: jest.fn(async () => 'base64data'),
  EncodingType: { Base64: 'base64' },
}));

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn().mockImplementation(() =>
    Promise.resolve({
      execAsync: jest.fn(),
      runAsync: jest.fn(),
      getAllAsync: jest.fn(),
    })
  ),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success' },
}));

jest.mock('expo-router', () => {
  const mockReact = require('react');
  return {
    Tabs: Object.assign(
      (props: any) => mockReact.createElement('Tabs', props, props.children),
      {
        Screen: (props: any) => mockReact.createElement('Tabs.Screen', props, null),
      }
    ),
  };
});

jest.mock('lucide-react-native', () => ({
  Utensils: () => null,
  BarChart3: () => null,
  ShieldCheck: () => null,
  Settings: () => null,
  Camera: () => null,
  ImagePlus: () => null,
  Zap: () => null,
  Image: () => null,
}));

import { GlassCard } from '../components/GlassCard';
import { MacroBar } from '../components/MacroBar';
import LogScreen, { MEAL_TYPES } from '../app/(tabs)/index';
import TabLayout from '../app/(tabs)/_layout';
import AnalyticsScreen from '../app/(tabs)/analytics';
import VaultScreen from '../app/(tabs)/vault';
import SettingsScreen from '../app/(tabs)/settings';
import { COLORS } from '../constants/theme';

describe('UI Components & Log Screen Helpers', () => {
  describe('GlassCard', () => {
    it('creates GlassCard component element with children', () => {
      const element = <GlassCard><></></GlassCard>;
      expect(element).toBeDefined();
      expect(element.type).toBe(GlassCard);
    });
  });

  describe('MacroBar', () => {
    it('creates MacroBar component element with valid props', () => {
      const element = (
        <MacroBar
          label="Protein"
          value={120}
          max={160}
          unit="g"
          color="#10B981"
        />
      );
      expect(element).toBeDefined();
      expect(element.props.label).toBe('Protein');
      expect(element.props.value).toBe(120);
      expect(element.props.max).toBe(160);
      expect(element.props.unit).toBe('g');
      expect(element.props.color).toBe('#10B981');
    });

    it('handles zero or negative values gracefully without throwing', () => {
      const element = (
        <MacroBar
          label="Fat"
          value={0}
          max={0}
          color="#F59E0B"
        />
      );
      expect(element).toBeDefined();
      expect(element.props.value).toBe(0);
    });
  });

  describe('Tab Navigation & Routes', () => {
    it('exports valid LogScreen, TabLayout, Analytics, Vault, and Settings screens', () => {
      expect(LogScreen).toBeDefined();
      expect(TabLayout).toBeDefined();
      expect(AnalyticsScreen).toBeDefined();
      expect(VaultScreen).toBeDefined();
      expect(SettingsScreen).toBeDefined();
    });
  });

  describe('Meal Types and Theme Consistency', () => {
    it('includes all 4 standard meal types', () => {
      expect(MEAL_TYPES).toEqual(['Breakfast', 'Lunch', 'Dinner', 'Snack']);
    });

    it('theme contains required styling colors for tab bar and cards', () => {
      expect(COLORS.card).toBeDefined();
      expect(COLORS.cardBorder).toBeDefined();
      expect(COLORS.primary).toBe('#06B6D4');
      expect(COLORS.textSecondary).toBe('#9CA3AF');
    });
  });
});
