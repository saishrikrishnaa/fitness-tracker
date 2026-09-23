import { formatLogForStorage, parseDbRowToLog, getDb, initDatabase, saveLogEntry, getLogEntries, getProgressPhotos } from '../db/database';
import { savePhotoLocally } from '../services/storage';
import { NewFitnessLog } from '../types/fitness';
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
});

describe('Photo Storage Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates directory if not exists and copies photo locally', async () => {
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
      to: expect.stringMatching(/^file:\/\/\/data\/user\/0\/host\.exp\.exponent\/files\/fuel_media\/meals\/meals_.*\.jpg$/),
    });
    expect(dest).toMatch(/^file:\/\/\/data\/user\/0\/host\.exp\.exponent\/files\/fuel_media\/meals\/meals_.*\.jpg$/);
  });

  it('skips directory creation if directory already exists', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
    (FileSystem.copyAsync as jest.Mock).mockResolvedValue(undefined);

    const dest = await savePhotoLocally('file:///temp/camera.jpg', 'progress');

    expect(FileSystem.makeDirectoryAsync).not.toHaveBeenCalled();
    expect(FileSystem.copyAsync).toHaveBeenCalledWith({
      from: 'file:///temp/camera.jpg',
      to: expect.stringMatching(/progress_.*\.jpg$/),
    });
  });
});
