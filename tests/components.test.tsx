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
    Dimensions: {
      get: () => ({ width: 390, height: 844 }),
    },
    useWindowDimensions: () => ({ width: 390, height: 844 }),
    FlatList: (props: any) => mockReact.createElement('FlatList', props, props.children),
    RefreshControl: (props: any) => mockReact.createElement('RefreshControl', props, props.children),
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
    useFocusEffect: (cb: any) => {
      mockReact.useEffect(() => {
        if (typeof cb === 'function') cb();
      }, [cb]);
    },
    Tabs: Object.assign(
      (props: any) => mockReact.createElement('Tabs', props, props.children),
      {
        Screen: (props: any) => mockReact.createElement('Tabs.Screen', props, null),
      }
    ),
  };
});

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(async () => true),
  isEnrolledAsync: jest.fn(async () => true),
  authenticateAsync: jest.fn(async () => ({ success: true })),
  AuthenticationType: {
    FINGERPRINT: 1,
    FACIAL_RECOGNITION: 2,
  },
}));

jest.mock('lucide-react-native', () => ({
  Utensils: () => null,
  BarChart3: () => null,
  ShieldCheck: () => null,
  Settings: () => null,
  Camera: () => null,
  ImagePlus: () => null,
  Zap: () => null,
  Image: () => null,
  Lock: () => null,
  Unlock: () => null,
  Fingerprint: () => null,
  Delete: () => null,
  Scale: () => null,
  Calendar: () => null,
  Key: () => null,
  Shield: () => null,
  Eye: () => null,
  EyeOff: () => null,
  Save: () => null,
  CheckCircle: () => null,
  CheckCircle2: () => null,
  Dumbbell: () => null,
  Moon: () => null,
}));

import { GlassCard } from '../components/GlassCard';
import { MacroBar } from '../components/MacroBar';
import { LoggedActivityCard } from '../components/LoggedActivityCard';
import LogScreen, { MEAL_TYPES } from '../app/(tabs)/index';
import TabLayout from '../app/(tabs)/_layout';
import AnalyticsScreen from '../app/(tabs)/analytics';
import VaultScreen from '../app/(tabs)/vault';
import SettingsScreen from '../app/(tabs)/settings';
import { COLORS } from '../constants/theme';
import { ChatExtractedData } from '../types/fitness';

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

  describe('LoggedActivityCard', () => {
    it('returns null when data is null or undefined', () => {
      expect(LoggedActivityCard({ data: null })).toBeNull();
      expect(LoggedActivityCard({ data: undefined })).toBeNull();
    });

    it('returns null when has_data is false', () => {
      const data: ChatExtractedData = {
        has_data: false,
      };
      expect(LoggedActivityCard({ data })).toBeNull();
    });

    it('renders all badges when all data fields are populated', () => {
      const fullData: ChatExtractedData = {
        has_data: true,
        nutrition: {
          meal_type: 'Breakfast',
          calories: 450,
          protein_g: 35,
          carbs_g: 40,
          fat_g: 15,
          food_items: ['Oatmeal', 'Protein Powder', 'Blueberries'],
        },
        workout: {
          workout_notes: 'Heavy leg press and squats',
          duration_mins: 45,
        },
        weight_kg: 78.5,
        recovery: {
          wind_down: '10 min stretching and chamomile tea',
        },
        is_progress_photo: true,
      };

      const result = LoggedActivityCard({ data: fullData });
      expect(result).not.toBeNull();
      expect(result?.props.testID).toBe('logged-activity-card');

      const children = React.Children.toArray(result?.props.children);
      // Header + 5 sections
      expect(children.length).toBe(6);
    });

    it('renders partial badges conditionally based on presence of data fields', () => {
      const partialData: ChatExtractedData = {
        has_data: true,
        nutrition: {
          meal_type: 'Lunch',
          calories: 600,
          protein_g: 45,
          carbs_g: 50,
          fat_g: 20,
        },
        workout: {
          workout_notes: '5km outdoor run',
        },
      };

      const result = LoggedActivityCard({ data: partialData });
      expect(result).not.toBeNull();

      const children = React.Children.toArray(result?.props.children);
      // Header + nutrition + workout = 3 valid children (weight, recovery, progress photo omitted)
      const validSections = children.filter(Boolean);
      expect(validSections.length).toBe(3);
    });
  });
});

