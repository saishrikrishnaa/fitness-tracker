import * as SQLite from 'expo-sqlite';
import {
  FitnessLogEntry,
  NewFitnessLog,
  ChatMessage,
  NewChatMessage,
  ChatExtractedData,
  ChatSession,
  DailyFitnessSummary,
  MealType,
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
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON chat_sessions(updated_at);
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT,
      sender TEXT NOT NULL,
      text TEXT NOT NULL,
      image_uri TEXT,
      extracted_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_chat_created_at ON chat_messages(created_at);
  `);

  try {
    await db.execAsync('ALTER TABLE chat_messages ADD COLUMN session_id TEXT;');
  } catch {
    // Column already exists
  }
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
    const key = `${date}|${mealType}`;
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

export async function getDailyFitnessSummary(targetDate?: string): Promise<DailyFitnessSummary> {
  const db = await getDb();
  const date = targetDate || new Date().toISOString().split('T')[0];
  const rows = await db.getAllAsync('SELECT * FROM fitness_logs WHERE date = ? ORDER BY id ASC', [date]);
  const entries: FitnessLogEntry[] = rows.map(parseDbRowToLog);

  let breakfast: FitnessLogEntry | null = null;
  let lunch: FitnessLogEntry | null = null;
  let dinner: FitnessLogEntry | null = null;
  let snack: FitnessLogEntry | null = null;
  let weight_kg: number | null = null;
  let workout_notes: string | null = null;
  let wind_down: string | null = null;

  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;

  for (const entry of entries) {
    totalCalories += entry.calories || 0;
    totalProtein += entry.protein_g || 0;
    totalCarbs += entry.carbs_g || 0;
    totalFat += entry.fat_g || 0;

    if (entry.weight_kg !== null && entry.weight_kg !== undefined) {
      weight_kg = entry.weight_kg;
    }
    if (entry.workout_notes) {
      workout_notes = workout_notes ? `${workout_notes}, ${entry.workout_notes}` : entry.workout_notes;
    }
    if (entry.wind_down) {
      wind_down = entry.wind_down;
    }

    const type = entry.meal_type;
    if (type === 'Breakfast') breakfast = entry;
    else if (type === 'Lunch') lunch = entry;
    else if (type === 'Dinner') dinner = entry;
    else if (type === 'Snack') snack = entry;
  }

  return {
    date,
    breakfast,
    lunch,
    dinner,
    snack,
    totalCalories,
    totalProtein,
    totalCarbs,
    totalFat,
    weight_kg,
    workout_notes,
    wind_down,
  };
}

export async function upsertDailyMealLog(
  date: string,
  mealType: MealType,
  data: Partial<NewFitnessLog>
): Promise<number> {
  const db = await getDb();
  const existingRows = await db.getAllAsync(
    'SELECT * FROM fitness_logs WHERE date = ? AND meal_type = ? ORDER BY id DESC',
    [date, mealType]
  );

  const timestamp = data.timestamp || new Date().toISOString();
  const calories = Number(data.calories) || 0;
  const protein_g = Number(data.protein_g) || 0;
  const carbs_g = Number(data.carbs_g) || 0;
  const fat_g = Number(data.fat_g) || 0;
  const weight_kg = data.weight_kg !== undefined ? data.weight_kg : null;
  const workout_notes = data.workout_notes || null;
  const wind_down = data.wind_down || null;
  const ai_feedback = JSON.stringify(data.ai_feedback || []);
  const meal_photo_uri = data.meal_photo_uri || null;
  const progress_photo_uri = data.progress_photo_uri || null;

  if (existingRows && existingRows.length > 0) {
    const existing = existingRows[0] as any;
    await db.runAsync(
      `UPDATE fitness_logs SET
        calories = ?,
        protein_g = ?,
        carbs_g = ?,
        fat_g = ?,
        weight_kg = COALESCE(?, weight_kg),
        workout_notes = COALESCE(?, workout_notes),
        wind_down = COALESCE(?, wind_down),
        meal_photo_uri = COALESCE(?, meal_photo_uri),
        progress_photo_uri = COALESCE(?, progress_photo_uri)
      WHERE id = ?`,
      [
        calories,
        protein_g,
        carbs_g,
        fat_g,
        weight_kg,
        workout_notes,
        wind_down,
        meal_photo_uri,
        progress_photo_uri,
        existing.id,
      ]
    );
    return existing.id;
  }

  const result = await db.runAsync(
    `INSERT INTO fitness_logs (
      timestamp, date, meal_type, calories, protein_g, carbs_g, fat_g,
      weight_kg, workout_notes, wind_down, ai_feedback, meal_photo_uri, progress_photo_uri
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      timestamp,
      date,
      mealType,
      calories,
      protein_g,
      carbs_g,
      fat_g,
      weight_kg,
      workout_notes,
      wind_down,
      ai_feedback,
      meal_photo_uri,
      progress_photo_uri,
    ]
  );
  return result.lastInsertRowId;
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
  const protein_g = extracted.nutrition?.protein_g || 0;
  const carbs_g = extracted.nutrition?.carbs_g || 0;
  const fat_g = extracted.nutrition?.fat_g || 0;
  const weight_kg = extracted.weight_kg ?? null;
  const workout_notes = extracted.workout?.workout_notes ?? null;
  const wind_down = extracted.recovery?.wind_down ?? null;

  return await upsertDailyMealLog(date, mealType, {
    timestamp,
    date,
    meal_type: mealType,
    calories,
    protein_g,
    carbs_g,
    fat_g,
    weight_kg,
    workout_notes,
    wind_down,
    ai_feedback: [],
    meal_photo_uri: mealPhotoUri ?? null,
    progress_photo_uri: progressPhotoUri ?? null,
  });
}

// ----------------------------------------------------
// Chat Sessions Management (Max 7 Days Retention)
// ----------------------------------------------------

export async function createChatSession(title: string = 'New Conversation'): Promise<ChatSession> {
  const db = await getDb();
  const id = `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  await db.runAsync(
    'INSERT INTO chat_sessions (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
    [id, title, now, now]
  );

  return {
    id,
    title,
    created_at: now,
    updated_at: now,
  };
}

export async function cleanupOldSessions(maxDays: number = 7): Promise<number> {
  const db = await getDb();
  const cutoffDate = new Date(Date.now() - maxDays * 24 * 60 * 60 * 1000).toISOString();
  
  const oldSessions = await db.getAllAsync(
    'SELECT id FROM chat_sessions WHERE created_at < ?',
    [cutoffDate]
  );

  if (oldSessions && oldSessions.length > 0) {
    for (const session of oldSessions as any[]) {
      await db.runAsync('DELETE FROM chat_messages WHERE session_id = ?', [session.id]);
      await db.runAsync('DELETE FROM chat_sessions WHERE id = ?', [session.id]);
    }
    return oldSessions.length;
  }
  return 0;
}

export async function getChatSessions(): Promise<ChatSession[]> {
  const db = await getDb();
  await cleanupOldSessions(7).catch(() => 0);
  const rows = await db.getAllAsync('SELECT * FROM chat_sessions ORDER BY updated_at DESC');
  return rows.map((r: any) => ({
    id: String(r.id),
    title: String(r.title || 'Chat Session'),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at || r.created_at),
  }));
}

export async function getChatSessionById(sessionId: string): Promise<ChatSession | null> {
  const db = await getDb();
  const rows = await db.getAllAsync('SELECT * FROM chat_sessions WHERE id = ?', [sessionId]);
  if (!rows || rows.length === 0) return null;
  const r = rows[0] as any;
  return {
    id: String(r.id),
    title: String(r.title || 'Chat Session'),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at || r.created_at),
  };
}

export async function updateChatSessionTitle(sessionId: string, title: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.runAsync(
    'UPDATE chat_sessions SET title = ?, updated_at = ? WHERE id = ?',
    [title, now, sessionId]
  );
}

export async function deleteChatSession(sessionId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM chat_messages WHERE session_id = ?', [sessionId]);
  await db.runAsync('DELETE FROM chat_sessions WHERE id = ?', [sessionId]);
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
    session_id: row.session_id ? String(row.session_id) : undefined,
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
    `INSERT INTO chat_messages (session_id, sender, text, image_uri, extracted_data) VALUES (?, ?, ?, ?, ?)`,
    [
      message.session_id ?? null,
      message.sender,
      message.text,
      imageField,
      extractedJson,
    ]
  );

  if (message.session_id) {
    const now = new Date().toISOString();
    await db.runAsync(
      'UPDATE chat_sessions SET updated_at = ? WHERE id = ?',
      [now, message.session_id]
    ).catch(() => {});
  }

  return result.lastInsertRowId;
}

export async function getChatMessages(sessionId?: string): Promise<ChatMessage[]> {
  const db = await getDb();
  let rows: any[] = [];
  if (sessionId) {
    rows = await db.getAllAsync(
      'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY id ASC',
      [sessionId]
    );
  } else {
    rows = await db.getAllAsync('SELECT * FROM chat_messages ORDER BY id ASC');
  }
  return rows.map(parseDbRowToChatMessage);
}

export async function clearChatMessages(sessionId?: string): Promise<void> {
  const db = await getDb();
  if (sessionId) {
    await db.runAsync('DELETE FROM chat_messages WHERE session_id = ?', [sessionId]);
  } else {
    await db.execAsync('DELETE FROM chat_messages');
  }
}

