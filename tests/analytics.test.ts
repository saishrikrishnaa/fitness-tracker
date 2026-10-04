import React from 'react';

jest.mock('react-native', () => {
  const mockReact = require('react');
  return {
    View: (props: any) => mockReact.createElement('View', props, props.children),
    Text: (props: any) => mockReact.createElement('Text', props, props.children),
    StyleSheet: {
      create: (styles: any) => styles,
    },
    ScrollView: (props: any) => mockReact.createElement('ScrollView', props, props.children),
    RefreshControl: (props: any) => mockReact.createElement('RefreshControl', props, props.children),
    TouchableOpacity: (props: any) => mockReact.createElement('TouchableOpacity', props, props.children),
    Alert: {
      alert: jest.fn(),
    },
  };
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: 'medium', Light: 'light', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Error: 'error', Warning: 'warning' },
}));

jest.mock('lucide-react-native', () => ({
  Trash2: () => null,
  Sparkles: () => null,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

jest.mock('expo-router', () => ({
  useFocusEffect: (cb: any) => {
    const mockReact = require('react');
    mockReact.useEffect(() => {
      if (typeof cb === 'function') cb();
    }, [cb]);
  },
}));

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn().mockImplementation(() =>
    Promise.resolve({
      execAsync: jest.fn(),
      runAsync: jest.fn(),
      getAllAsync: jest.fn().mockResolvedValue([]),
    })
  ),
}));

import AnalyticsScreen, { calculateDailyAverages, calculateStreak } from '../app/(tabs)/analytics';
import { FitnessLogEntry } from '../types/fitness';

describe('Analytics Calculations', () => {
  it('correctly calculates average daily calories across days', () => {
    const logs: Partial<FitnessLogEntry>[] = [
      { date: '2026-09-20', calories: 800 },
      { date: '2026-09-20', calories: 1200 },
      { date: '2026-09-21', calories: 2500 },
    ];

    const avg = calculateDailyAverages(logs as FitnessLogEntry[]);
    expect(avg).toBe(2250);
  });

  it('returns 0 when logs array is empty', () => {
    expect(calculateDailyAverages([])).toBe(0);
  });

  it('calculates consecutive logging streak accurately', () => {
    const logs: Partial<FitnessLogEntry>[] = [
      { date: '2026-09-23' },
      { date: '2026-09-22' },
      { date: '2026-09-21' },
    ];
    expect(calculateStreak(logs as FitnessLogEntry[], '2026-09-23')).toBe(3);
  });

  it('returns 0 streak when logs array is empty', () => {
    expect(calculateStreak([], '2026-09-23')).toBe(0);
  });

  it('calculates streak starting from yesterday if today is not yet logged', () => {
    const logs: Partial<FitnessLogEntry>[] = [
      { date: '2026-09-22' },
      { date: '2026-09-21' },
    ];
    expect(calculateStreak(logs as FitnessLogEntry[], '2026-09-23')).toBe(2);
  });

  it('returns 0 streak if streak is broken (gap greater than 1 day)', () => {
    const logs: Partial<FitnessLogEntry>[] = [
      { date: '2026-09-20' },
      { date: '2026-09-19' },
    ];
    expect(calculateStreak(logs as FitnessLogEntry[], '2026-09-23')).toBe(0);
  });

  it('handles duplicate logs on the same date without inflating streak', () => {
    const logs: Partial<FitnessLogEntry>[] = [
      { date: '2026-09-23', calories: 500 },
      { date: '2026-09-23', calories: 700 },
      { date: '2026-09-22', calories: 600 },
    ];
    expect(calculateStreak(logs as FitnessLogEntry[], '2026-09-23')).toBe(2);
  });

  it('exports valid AnalyticsScreen component', () => {
    expect(AnalyticsScreen).toBeDefined();
    const element = React.createElement(AnalyticsScreen);
    expect(element).toBeDefined();
  });
});
