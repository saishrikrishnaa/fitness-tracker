import * as SQLite from 'expo-sqlite';
import { FitnessLogEntry, NewFitnessLog } from '../types/fitness';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('fuel_fitness.db');
      await initDatabase(db);
      return db;
    })();
  }
  return dbPromise;
}

export async function initDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS fitness_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      date TEXT NOT NULL,
      meal_type TEXT NOT NULL,
      calories REAL NOT NULL DEFAULT 0.0,
      protein_g REAL NOT NULL DEFAULT 0.0,
      carbs_g REAL NOT NULL DEFAULT 0.0,
      fat_g REAL NOT NULL DEFAULT 0.0,
      weight_kg REAL,
      workout_notes TEXT,
      wind_down TEXT,
      ai_feedback TEXT,
      meal_photo_uri TEXT,
      progress_photo_uri TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_logs_date ON fitness_logs(date);
    CREATE TABLE IF NOT EXISTS user_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

export function formatLogForStorage(entry: NewFitnessLog) {
  return {
    ...entry,
    ai_feedback: JSON.stringify(entry.ai_feedback || []),
    weight_kg: entry.weight_kg ?? null,
    workout_notes: entry.workout_notes ?? null,
    wind_down: entry.wind_down ?? null,
    meal_photo_uri: entry.meal_photo_uri ?? null,
    progress_photo_uri: entry.progress_photo_uri ?? null,
  };
}

export function parseDbRowToLog(row: any): FitnessLogEntry {
  let feedback: string[] = [];
  try {
    if (typeof row.ai_feedback === 'string') {
      const parsed = JSON.parse(row.ai_feedback);
      feedback = Array.isArray(parsed) ? parsed : [];
    } else if (Array.isArray(row.ai_feedback)) {
      feedback = row.ai_feedback;
    } else {
      feedback = [];
    }
  } catch {
    feedback = [];
  }
  return {
    id: row.id,
    timestamp: row.timestamp,
    date: row.date,
    meal_type: row.meal_type,
    calories: Number(row.calories) || 0,
    protein_g: Number(row.protein_g) || 0,
    carbs_g: Number(row.carbs_g) || 0,
    fat_g: Number(row.fat_g) || 0,
    weight_kg: row.weight_kg !== null && row.weight_kg !== undefined ? Number(row.weight_kg) : null,
    workout_notes: row.workout_notes || null,
    wind_down: row.wind_down || null,
    ai_feedback: feedback,
    meal_photo_uri: row.meal_photo_uri || null,
    progress_photo_uri: row.progress_photo_uri || null,
    created_at: row.created_at || row.timestamp,
  };
}

export async function saveLogEntry(entry: NewFitnessLog): Promise<number> {
  const db = await getDb();
  const data = formatLogForStorage(entry);
  const result = await db.runAsync(
    `INSERT INTO fitness_logs (
      timestamp, date, meal_type, calories, protein_g, carbs_g, fat_g,
      weight_kg, workout_notes, wind_down, ai_feedback, meal_photo_uri, progress_photo_uri
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.timestamp,
      data.date,
      data.meal_type,
      data.calories,
      data.protein_g,
      data.carbs_g,
      data.fat_g,
      data.weight_kg,
      data.workout_notes,
      data.wind_down,
      data.ai_feedback,
      data.meal_photo_uri,
      data.progress_photo_uri,
    ]
  );
  return result.lastInsertRowId;
}

export async function getLogEntries(): Promise<FitnessLogEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync('SELECT * FROM fitness_logs ORDER BY id DESC');
  return rows.map(parseDbRowToLog);
}

export async function getProgressPhotos(): Promise<FitnessLogEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync(
    "SELECT * FROM fitness_logs WHERE progress_photo_uri IS NOT NULL AND progress_photo_uri != '' ORDER BY id DESC"
  );
  return rows.map(parseDbRowToLog);
}
