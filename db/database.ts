import * as SQLite from 'expo-sqlite';
import {
  FitnessLogEntry,
  NewFitnessLog,
  ChatMessage,
  NewChatMessage,
  ChatExtractedData,
} from '../types/fitness';

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
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender TEXT NOT NULL,
      text TEXT NOT NULL,
      image_uri TEXT,
      extracted_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_chat_created_at ON chat_messages(created_at);
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

export async function deleteLogEntry(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM fitness_logs WHERE id = ?', [id]);
}

export async function clearAllFitnessLogs(): Promise<void> {
  const db = await getDb();
  await db.execAsync('DELETE FROM fitness_logs');
}

export async function deduplicateFitnessLogs(): Promise<number> {
  const db = await getDb();
  const rows = await db.getAllAsync('SELECT * FROM fitness_logs ORDER BY date DESC, id DESC');
  if (!rows || rows.length <= 1) return 0;

  const seenKeys = new Set<string>();
  const idsToDelete: number[] = [];

  for (const row of rows as any[]) {
    const date = row.date || '';
    const mealType = (row.meal_type || '').trim().toLowerCase();
    const calories = Math.round(Number(row.calories) || 0);
    const workout = (row.workout_notes || '').trim().toLowerCase();
    const weight = row.weight_kg != null ? Number(row.weight_kg).toFixed(1) : '';

    const key = `${date}|${mealType}|${calories}|${workout}|${weight}`;
    if (seenKeys.has(key)) {
      idsToDelete.push(Number(row.id));
    } else {
      seenKeys.add(key);
    }
  }

  if (idsToDelete.length > 0) {
    for (const id of idsToDelete) {
      await db.runAsync('DELETE FROM fitness_logs WHERE id = ?', [id]);
    }
  }

  return idsToDelete.length;
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

export function parseDbRowToChatMessage(row: any): ChatMessage {
  let extracted: ChatExtractedData | null = null;
  try {
    if (typeof row.extracted_data === 'string') {
      extracted = JSON.parse(row.extracted_data);
    } else if (row.extracted_data && typeof row.extracted_data === 'object') {
      extracted = row.extracted_data;
    }
  } catch {
    extracted = null;
  }

  let singleImageUri: string | null = null;
  let imageUris: string[] | undefined = undefined;

  if (row.image_uri && typeof row.image_uri === 'string') {
    try {
      if (row.image_uri.startsWith('[')) {
        const parsed = JSON.parse(row.image_uri);
        if (Array.isArray(parsed)) {
          imageUris = parsed.map(String);
          singleImageUri = imageUris[0] || null;
        }
      }
    } catch {
      // Not a JSON array
    }
    if (!singleImageUri) {
      singleImageUri = row.image_uri;
      imageUris = [row.image_uri];
    }
  }

  return {
    id: row.id,
    sender: row.sender,
    text: row.text,
    image_uri: singleImageUri,
    image_uris: imageUris,
    extracted_data: extracted,
    created_at: row.created_at,
  };
}

export async function saveChatMessage(message: NewChatMessage): Promise<number> {
  const db = await getDb();
  const extractedJson = message.extracted_data ? JSON.stringify(message.extracted_data) : null;
  const imageField = message.image_uris && message.image_uris.length > 0
    ? JSON.stringify(message.image_uris)
    : message.image_uri ?? null;

  const result = await db.runAsync(
    `INSERT INTO chat_messages (sender, text, image_uri, extracted_data) VALUES (?, ?, ?, ?)`,
    [
      message.sender,
      message.text,
      imageField,
      extractedJson,
    ]
  );
  return result.lastInsertRowId;
}

export async function getChatMessages(): Promise<ChatMessage[]> {
  const db = await getDb();
  const rows = await db.getAllAsync('SELECT * FROM chat_messages ORDER BY id ASC');
  return rows.map(parseDbRowToChatMessage);
}

export async function clearChatMessages(): Promise<void> {
  const db = await getDb();
  await db.execAsync('DELETE FROM chat_messages');
}

export async function saveLogFromExtractedData(
  extracted: ChatExtractedData,
  mealPhotoUri?: string | null,
  progressPhotoUri?: string | null
): Promise<number | null> {
  if (!extracted.has_data || extracted.is_new_log === false) {
    return null;
  }
  const now = new Date();
  const timestamp = now.toISOString();
  const date = timestamp.split('T')[0];

  const mealType = extracted.nutrition?.meal_type || 'Lunch';
  const calories = extracted.nutrition?.calories || 0;
  const protein = extracted.nutrition?.protein_g || 0;
  const carbs = extracted.nutrition?.carbs_g || 0;
  const fat = extracted.nutrition?.fat_g || 0;
  const weight = extracted.weight_kg ?? null;
  const workoutNotes = extracted.workout?.workout_notes ?? null;
  const windDown = extracted.recovery?.wind_down ?? null;

  const db = await getDb();

  // Deduplicate against logs from today
  const existingToday = await db.getAllAsync(
    'SELECT * FROM fitness_logs WHERE date = ? ORDER BY id DESC',
    [date]
  );

  for (const existing of existingToday as any[]) {
    const isSameMeal =
      calories > 0 &&
      existing.meal_type === mealType &&
      (Math.abs(existing.calories - calories) < 30 || Math.abs(existing.protein_g - protein) < 5);

    const isSameWorkout =
      workoutNotes &&
      existing.workout_notes &&
      existing.workout_notes.toLowerCase().trim() === workoutNotes.toLowerCase().trim();

    const isSameWeight =
      weight !== null &&
      existing.weight_kg !== null &&
      Math.abs(existing.weight_kg - weight) < 0.2 &&
      calories === 0 &&
      !workoutNotes;

    if (isSameMeal || isSameWorkout || isSameWeight) {
      // Update existing entry instead of adding duplicate row
      await db.runAsync(
        `UPDATE fitness_logs SET
          calories = CASE WHEN ? > 0 THEN ? ELSE calories END,
          protein_g = CASE WHEN ? > 0 THEN ? ELSE protein_g END,
          carbs_g = CASE WHEN ? > 0 THEN ? ELSE carbs_g END,
          fat_g = CASE WHEN ? > 0 THEN ? ELSE fat_g END,
          weight_kg = COALESCE(?, weight_kg),
          workout_notes = COALESCE(?, workout_notes),
          wind_down = COALESCE(?, wind_down),
          meal_photo_uri = COALESCE(?, meal_photo_uri),
          progress_photo_uri = COALESCE(?, progress_photo_uri)
        WHERE id = ?`,
        [
          calories, calories,
          protein, protein,
          carbs, carbs,
          fat, fat,
          weight,
          workoutNotes,
          windDown,
          mealPhotoUri ?? null,
          progressPhotoUri ?? null,
          existing.id,
        ]
      );
      return existing.id;
    }
  }

  const logEntry: NewFitnessLog = {
    timestamp,
    date,
    meal_type: mealType,
    calories,
    protein_g: protein,
    carbs_g: carbs,
    fat_g: fat,
    weight_kg: weight,
    workout_notes: workoutNotes,
    wind_down: windDown,
    ai_feedback: [],
    meal_photo_uri: mealPhotoUri ?? null,
    progress_photo_uri: progressPhotoUri ?? null,
  };

  return await saveLogEntry(logEntry);
}

