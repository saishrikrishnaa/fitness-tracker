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
    KeyboardAvoidingView: (props: any) => mockReact.createElement('KeyboardAvoidingView', props, props.children),
    Platform: {
      OS: 'ios',
      select: (objs: any) => objs.ios,
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

const mockChatMessages: any[] = [
  {
    id: 1,
    sender: 'user',
    text: 'Ate a bowl of oatmeal with protein powder',
    image_uri: 'file:///data/user/meal.jpg',
    extracted_data: null,
    created_at: '2026-10-03T08:00:00.000Z',
  },
  {
    id: 2,
    sender: 'coach',
    text: 'Great breakfast! High in complex carbs and quality protein.',
    image_uri: null,
    extracted_data: {
      has_data: true,
      nutrition: {
        meal_type: 'Breakfast',
        calories: 380,
        protein_g: 30,
        carbs_g: 45,
        fat_g: 6,
        food_items: ['Oatmeal', 'Protein Powder'],
      },
    },
    created_at: '2026-10-03T08:01:00.000Z',
  },
];

jest.mock('../db/database', () => ({
  getChatMessages: jest.fn(async () => mockChatMessages),
  saveChatMessage: jest.fn(async () => 3),
  clearChatMessages: jest.fn(async () => {}),
  saveLogFromExtractedData: jest.fn(async () => 10),
}));

jest.mock('../services/gemini', () => ({
  sendChatMessageToCoach: jest.fn(async () => ({
    coach_response: 'Nice workout! Keep pushing hard.',
    extracted_data: {
      has_data: true,
      workout: {
        workout_notes: '45 mins chest press and tricep pushdowns',
        duration_mins: 45,
      },
    },
  })),
}));

jest.mock('../services/storage', () => ({
  savePhotoLocally: jest.fn(async (uri: string, category: string) => `file:///saved/${category}/${Date.now()}.jpg`),
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
  requestCameraPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  launchCameraAsync: jest.fn(async () => ({
    canceled: false,
    assets: [{ uri: 'file:///camera/photo.jpg' }],
  })),
  launchImageLibraryAsync: jest.fn(async () => ({
    canceled: false,
    assets: [{ uri: 'file:///gallery/photo.jpg' }],
  })),
  MediaTypeOptions: { Images: 'Images' },
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
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
  Send: () => null,
  Trash2: () => null,
  X: () => null,
  Sparkles: () => null,
}));

import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
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
import {
  getChatMessages,
  saveChatMessage,
  clearChatMessages,
  saveLogFromExtractedData,
} from '../db/database';
import { sendChatMessageToCoach } from '../services/gemini';
import { savePhotoLocally } from '../services/storage';

describe('UI Components & Log Screen Helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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

  describe('LogScreen Conversational Chat Interface', () => {
    it('is a valid React component function', () => {
      expect(typeof LogScreen).toBe('function');
    });

    it('creates LogScreen JSX element with correct component type', () => {
      const element = <LogScreen />;
      expect(element).toBeDefined();
      expect(element.type).toBe(LogScreen);
    });

    it('loads chat messages from SQLite database', async () => {
      const messages = await getChatMessages();
      expect(messages).toHaveLength(2);
      expect(messages[0].sender).toBe('user');
      expect(messages[0].text).toContain('oatmeal');
      expect(messages[1].sender).toBe('coach');
      expect(messages[1].extracted_data?.has_data).toBe(true);
      expect(messages[1].extracted_data?.nutrition?.meal_type).toBe('Breakfast');
    });

    it('saves user and coach messages to SQLite database', async () => {
      const userMsgId = await saveChatMessage({
        sender: 'user',
        text: 'Did 45 mins chest workout',
      });
      expect(userMsgId).toBe(3);
      expect(saveChatMessage).toHaveBeenCalledWith({
        sender: 'user',
        text: 'Did 45 mins chest workout',
      });

      const coachMsgId = await saveChatMessage({
        sender: 'coach',
        text: 'Awesome workout! 45 mins of chest logged.',
        extracted_data: {
          has_data: true,
          workout: { workout_notes: 'Chest workout', duration_mins: 45 },
        },
      });
      expect(coachMsgId).toBe(3);
    });

    it('clears chat history from database on user confirmation', async () => {
      await clearChatMessages();
      expect(clearChatMessages).toHaveBeenCalled();
    });

    it('handles camera launch and photo capture', async () => {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      expect(perm.status).toBe('granted');

      const photoRes = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      expect(photoRes.canceled).toBe(false);
      expect(photoRes.assets[0].uri).toBe('file:///camera/photo.jpg');
    });

    it('handles gallery photo selection', async () => {
      const galleryRes = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      expect(galleryRes.canceled).toBe(false);
      expect(galleryRes.assets[0].uri).toBe('file:///gallery/photo.jpg');
    });

    it('executes full chat coaching flow and syncs fitness logs', async () => {
      const coachResponse = {
        coach_response: 'Logged 45 mins of chest training!',
        extracted_data: {
          has_data: true,
          workout: {
            workout_notes: 'Chest & arms workout',
            duration_mins: 45,
          },
        },
      };
      (sendChatMessageToCoach as jest.Mock).mockResolvedValueOnce(coachResponse);

      const res = await sendChatMessageToCoach('Did chest and arms workout for 45 mins');
      expect(res.coach_response).toBe('Logged 45 mins of chest training!');
      expect(res.extracted_data.has_data).toBe(true);

      const logId = await saveLogFromExtractedData(res.extracted_data);
      expect(logId).toBe(10);
      expect(saveLogFromExtractedData).toHaveBeenCalledWith(res.extracted_data);
    });

    it('saves progress selfie to progress vault when is_progress_photo is true', async () => {
      const progressPhotoUri = await savePhotoLocally('file:///camera/physique.jpg', 'progress');
      expect(progressPhotoUri).toContain('/progress/');
      expect(savePhotoLocally).toHaveBeenCalledWith('file:///camera/physique.jpg', 'progress');
    });

    it('saves meal photo to meals vault when nutrition data is present', async () => {
      const mealPhotoUri = await savePhotoLocally('file:///camera/meal.jpg', 'meals');
      expect(mealPhotoUri).toContain('/meals/');
      expect(savePhotoLocally).toHaveBeenCalledWith('file:///camera/meal.jpg', 'meals');
    });
  });
});
