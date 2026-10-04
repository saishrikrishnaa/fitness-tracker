import {
  formatLogForStorage,
  parseDbRowToLog,
  getDb,
  initDatabase,
  saveLogEntry,
  getLogEntries,
  getProgressPhotos,
  saveChatMessage,
  getChatMessages,
  clearChatMessages,
  saveLogFromExtractedData,
  deleteLogEntry,
  clearAllFitnessLogs,
  deduplicateFitnessLogs,
} from '../db/database';
import { savePhotoLocally } from '../services/storage';
import { NewFitnessLog, ChatMessage, NewChatMessage, ChatExtractedData } from '../types/fitness';
import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';

const mockDb = {
  execAsync: jest.fn(),
  runAsync: jest.fn(),
  getAllAsync: jest.fn(),
};

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn().mockImplementation(() => Promise.resolve(mockDb)),
}));

jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///data/user/0/host.exp.exponent/files/',
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  copyAsync: jest.fn(),
}));

describe('Database Formatting Helpers', () => {
  it('correctly serializes feedback array to JSON string', () => {
    const entry: NewFitnessLog = {
      timestamp: '2026-09-23T10:00:00Z',
      date: '2026-09-23',
      meal_type: 'Lunch',
      calories: 550,
      protein_g: 45,
      carbs_g: 50,
      fat_g: 15,
      weight_kg: 72.5,
      workout_notes: 'Chest day',
      wind_down: 'Reading',
      ai_feedback: ['✅ High protein', '💡 Add veggies'],
    };

    const formatted = formatLogForStorage(entry);
    expect(formatted.ai_feedback).toBe('["✅ High protein","💡 Add veggies"]');
    expect(formatted.calories).toBe(550);
    expect(formatted.weight_kg).toBe(72.5);
    expect(formatted.meal_photo_uri).toBeNull();
    expect(formatted.progress_photo_uri).toBeNull();
  });

  it('correctly parses database row into typed FitnessLogEntry', () => {
    const row = {
      id: 1,
      timestamp: '2026-09-23T10:00:00Z',
      date: '2026-09-23',
      meal_type: 'Lunch',
      calories: 550,
      protein_g: 45,
      carbs_g: 50,
      fat_g: 15,
      weight_kg: 72.5,
      workout_notes: 'Chest day',
      wind_down: 'Reading',
      ai_feedback: '["✅ High protein","💡 Add veggies"]',
      meal_photo_uri: 'file:///photo.jpg',
      progress_photo_uri: null,
      created_at: '2026-09-23 10:00:00',
    };

    const parsed = parseDbRowToLog(row);
    expect(parsed.ai_feedback).toEqual(['✅ High protein', '💡 Add veggies']);
    expect(parsed.calories).toBe(550);
    expect(parsed.progress_photo_uri).toBeNull();
    expect(parsed.meal_photo_uri).toBe('file:///photo.jpg');
    expect(parsed.id).toBe(1);
  });

  it('safely handles corrupted ai_feedback in database row', () => {
    const row = {
      id: 2,
      timestamp: '2026-09-23T12:00:00Z',
      date: '2026-09-23',
      meal_type: 'Dinner',
      calories: '700',
      protein_g: '50',
      carbs_g: '60',
      fat_g: '20',
      weight_kg: null,
      workout_notes: null,
      wind_down: null,
      ai_feedback: 'invalid-json',
      meal_photo_uri: null,
      progress_photo_uri: null,
    };

    const parsed = parseDbRowToLog(row);
    expect(parsed.ai_feedback).toEqual([]);
    expect(parsed.calories).toBe(700);
    expect(parsed.protein_g).toBe(50);
    expect(parsed.weight_kg).toBeNull();
    expect(parsed.created_at).toBe('2026-09-23T12:00:00Z');
  });

  it('safely handles non-array JSON object in ai_feedback', () => {
    const row = {
      id: 3,
      timestamp: '2026-09-23T12:00:00Z',
      date: '2026-09-23',
      meal_type: 'Dinner',
      calories: 500,
      protein_g: 30,
      carbs_g: 40,
      fat_g: 10,
      weight_kg: null,
      workout_notes: null,
      wind_down: null,
      ai_feedback: '{"someKey": "someValue"}',
      meal_photo_uri: null,
      progress_photo_uri: null,
    };

    const parsed = parseDbRowToLog(row);
    expect(parsed.ai_feedback).toEqual([]);
  });
});

describe('Database Operations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.execAsync.mockResolvedValue(undefined);
    mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 42 });
    mockDb.getAllAsync.mockResolvedValue([]);
  });

  it('initializes database with correct schema and tables', async () => {
    await initDatabase(mockDb as any);
    expect(mockDb.execAsync).toHaveBeenCalled();
    const query = mockDb.execAsync.mock.calls[0][0];
    expect(query).toContain('CREATE TABLE IF NOT EXISTS fitness_logs');
    expect(query).toContain('CREATE TABLE IF NOT EXISTS user_settings');
    expect(query).toContain('CREATE INDEX IF NOT EXISTS idx_logs_date');
  });

  it('handles concurrent getDb calls returning the same singleton promise', async () => {
    const [db1, db2] = await Promise.all([getDb(), getDb()]);
    expect(db1).toBe(mockDb);
    expect(db2).toBe(mockDb);
  });

  it('saves a log entry and returns the inserted row id', async () => {
    const entry: NewFitnessLog = {
      timestamp: '2026-09-23T10:00:00Z',
      date: '2026-09-23',
      meal_type: 'Breakfast',
      calories: 400,
      protein_g: 30,
      carbs_g: 40,
      fat_g: 10,
      ai_feedback: ['Good breakfast'],
    };

    const insertId = await saveLogEntry(entry);
    expect(insertId).toBe(42);
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO fitness_logs'),
      expect.arrayContaining(['Breakfast', 400, 30, 40, 10])
    );
  });

  it('retrieves log entries ordered by id DESC', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([
      {
        id: 1,
        timestamp: '2026-09-23T10:00:00Z',
        date: '2026-09-23',
        meal_type: 'Breakfast',
        calories: 400,
        protein_g: 30,
        carbs_g: 40,
        fat_g: 10,
        weight_kg: null,
        workout_notes: null,
        wind_down: null,
        ai_feedback: '[]',
        meal_photo_uri: null,
        progress_photo_uri: null,
        created_at: '2026-09-23 10:00:00',
      },
    ]);

    const logs = await getLogEntries();
    expect(mockDb.getAllAsync).toHaveBeenCalledWith('SELECT * FROM fitness_logs ORDER BY id DESC');
    expect(logs).toHaveLength(1);
    expect(logs[0].meal_type).toBe('Breakfast');
  });

  it('retrieves progress photos only', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([
      {
        id: 2,
        timestamp: '2026-09-23T18:00:00Z',
        date: '2026-09-23',
        meal_type: 'Dinner',
        calories: 600,
        protein_g: 50,
        carbs_g: 50,
        fat_g: 20,
        weight_kg: 72.0,
        workout_notes: null,
        wind_down: null,
        ai_feedback: '[]',
        meal_photo_uri: null,
        progress_photo_uri: 'file:///progress.jpg',
        created_at: '2026-09-23 18:00:00',
      },
    ]);

    const photos = await getProgressPhotos();
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('progress_photo_uri IS NOT NULL')
    );
    expect(photos).toHaveLength(1);
    expect(photos[0].progress_photo_uri).toBe('file:///progress.jpg');
  });

  it('saves a chat message with extracted data and returns insert id', async () => {
    const msg: NewChatMessage = {
      sender: 'coach',
      text: 'Great job!',
      image_uri: 'file:///meal.jpg',
      extracted_data: {
        has_data: true,
        nutrition: {
          meal_type: 'Lunch',
          calories: 500,
          protein_g: 40,
          carbs_g: 50,
          fat_g: 15,
          food_items: ['Chicken', 'Rice'],
        },
      },
    };

    const id = await saveChatMessage(msg);
    expect(id).toBe(42);
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO chat_messages'),
      [
        'coach',
        'Great job!',
        'file:///meal.jpg',
        JSON.stringify(msg.extracted_data),
      ]
    );
  });

  it('saves a chat message without extracted data (null)', async () => {
    const msg: NewChatMessage = {
      sender: 'user',
      text: 'Hello coach',
    };

    const id = await saveChatMessage(msg);
    expect(id).toBe(42);
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO chat_messages'),
      ['user', 'Hello coach', null, null]
    );
  });

  it('retrieves chat messages and correctly parses extracted_data JSON', async () => {
    const extractedData: ChatExtractedData = {
      has_data: true,
      nutrition: {
        meal_type: 'Dinner',
        calories: 600,
        protein_g: 45,
        carbs_g: 55,
        fat_g: 20,
      },
    };
    mockDb.getAllAsync.mockResolvedValueOnce([
      {
        id: 1,
        sender: 'user',
        text: 'Ate dinner',
        image_uri: null,
        extracted_data: JSON.stringify(extractedData),
        created_at: '2026-10-03 10:00:00',
      },
      {
        id: 2,
        sender: 'coach',
        text: 'Awesome!',
        image_uri: null,
        extracted_data: null,
        created_at: '2026-10-03 10:01:00',
      },
    ]);

    const messages = await getChatMessages();
    expect(mockDb.getAllAsync).toHaveBeenCalledWith('SELECT * FROM chat_messages ORDER BY id ASC');
    expect(messages).toHaveLength(2);
    expect(messages[0].extracted_data).toEqual(extractedData);
    expect(messages[0].sender).toBe('user');
    expect(messages[1].extracted_data).toBeNull();
  });

  it('clears all chat messages', async () => {
    await clearChatMessages();
    expect(mockDb.execAsync).toHaveBeenCalledWith('DELETE FROM chat_messages');
  });

  describe('saveLogFromExtractedData', () => {
    it('saves fitness log entry when extracted has_data is true', async () => {
      const extracted: ChatExtractedData = {
        has_data: true,
        nutrition: {
          meal_type: 'Dinner',
          calories: 650,
          protein_g: 50,
          carbs_g: 60,
          fat_g: 20,
          food_items: ['Steak', 'Potatoes'],
        },
        workout: {
          workout_notes: 'Leg day - Squats 5x5',
          duration_mins: 45,
        },
        weight_kg: 75.2,
        recovery: {
          wind_down: 'Stretching & bath',
        },
        is_progress_photo: false,
      };

      const result = await saveLogFromExtractedData(extracted, 'file:///meal.jpg', null);
      expect(result).toBe(42);
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO fitness_logs'),
        expect.arrayContaining([
          'Dinner',
          650,
          50,
          60,
          20,
          75.2,
          'Leg day - Squats 5x5',
          'Stretching & bath',
          '[]',
          'file:///meal.jpg',
          null,
        ])
      );
    });

    it('returns null and does not save log entry when has_data is false', async () => {
      const extracted: ChatExtractedData = {
        has_data: false,
      };

      const result = await saveLogFromExtractedData(extracted);
      expect(result).toBeNull();
      expect(mockDb.runAsync).not.toHaveBeenCalled();
    });

    it('uses fallback default values when nutrition fields are missing but has_data is true', async () => {
      const extracted: ChatExtractedData = {
        has_data: true,
        workout: {
          workout_notes: 'Cardio run',
        },
      };

      const result = await saveLogFromExtractedData(extracted);
      expect(result).toBe(42);
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO fitness_logs'),
        expect.arrayContaining([
          'Lunch',
          0,
          0,
          0,
          0,
          null,
          'Cardio run',
          null,
          '[]',
          null,
          null,
        ])
      );
    });

    it('updates existing log entry instead of inserting duplicate on same day meal', async () => {
      const todayStr = new Date().toISOString().split('T')[0];
      mockDb.getAllAsync.mockResolvedValueOnce([
        {
          id: 10,
          date: todayStr,
          meal_type: 'Lunch',
          calories: 600,
          protein_g: 40,
          carbs_g: 50,
          fat_g: 15,
          workout_notes: null,
          weight_kg: null,
        },
      ]);

      const extracted: ChatExtractedData = {
        has_data: true,
        is_new_log: true,
        nutrition: {
          meal_type: 'Lunch',
          calories: 620,
          protein_g: 42,
          carbs_g: 50,
          fat_g: 15,
        },
      };

      const result = await saveLogFromExtractedData(extracted, 'file:///new_lunch.jpg');
      expect(result).toBe(10);
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE fitness_logs SET'),
        expect.arrayContaining([620, 620, 42, 42, 'file:///new_lunch.jpg', 10])
      );
    });
  });

  describe('Deduplication and Deletion Helpers', () => {
    it('deletes a log entry by ID', async () => {
      await deleteLogEntry(5);
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        'DELETE FROM fitness_logs WHERE id = ?',
        [5]
      );
    });

    it('clears all fitness logs', async () => {
      await clearAllFitnessLogs();
      expect(mockDb.execAsync).toHaveBeenCalledWith('DELETE FROM fitness_logs');
    });

    it('detects and removes duplicate logs preserving the latest entry', async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([
        { id: 4, date: '2026-10-04', meal_type: 'Lunch', calories: 600, workout_notes: '', weight_kg: null },
        { id: 3, date: '2026-10-04', meal_type: 'Lunch', calories: 600, workout_notes: '', weight_kg: null },
        { id: 2, date: '2026-10-04', meal_type: 'Dinner', calories: 800, workout_notes: '', weight_kg: null },
        { id: 1, date: '2026-10-04', meal_type: 'Lunch', calories: 600, workout_notes: '', weight_kg: null },
      ]);

      const removed = await deduplicateFitnessLogs();
      expect(removed).toBe(2);
      expect(mockDb.runAsync).toHaveBeenCalledWith('DELETE FROM fitness_logs WHERE id = ?', [3]);
      expect(mockDb.runAsync).toHaveBeenCalledWith('DELETE FROM fitness_logs WHERE id = ?', [1]);
    });
  });
});

describe('Photo Storage Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates directory if not exists and copies photo locally with unique suffix', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });
    (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
    (FileSystem.copyAsync as jest.Mock).mockResolvedValue(undefined);

    const dest = await savePhotoLocally('file:///temp/camera.jpg', 'meals');

    expect(FileSystem.getInfoAsync).toHaveBeenCalledWith(
      'file:///data/user/0/host.exp.exponent/files/fuel_media/meals/'
    );
    expect(FileSystem.makeDirectoryAsync).toHaveBeenCalledWith(
      'file:///data/user/0/host.exp.exponent/files/fuel_media/meals/',
      { intermediates: true }
    );
    expect(FileSystem.copyAsync).toHaveBeenCalledWith({
      from: 'file:///temp/camera.jpg',
      to: expect.stringMatching(/^file:\/\/\/data\/user\/0\/host\.exp\.exponent\/files\/fuel_media\/meals\/meals_.*_[a-z0-9]+\.jpg$/),
    });
    expect(dest).toMatch(/^file:\/\/\/data\/user\/0\/host\.exp\.exponent\/files\/fuel_media\/meals\/meals_.*_[a-z0-9]+\.jpg$/);
  });

  it('skips directory creation if directory already exists', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
    (FileSystem.copyAsync as jest.Mock).mockResolvedValue(undefined);

    const dest = await savePhotoLocally('file:///temp/camera.jpg', 'progress');

    expect(FileSystem.makeDirectoryAsync).not.toHaveBeenCalled();
    expect(FileSystem.copyAsync).toHaveBeenCalledWith({
      from: 'file:///temp/camera.jpg',
      to: expect.stringMatching(/progress_.*_[a-z0-9]+\.jpg$/),
    });
  });
});
