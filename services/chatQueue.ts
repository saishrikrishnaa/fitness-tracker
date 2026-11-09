import {
  getUnparsedUserMessages,
  getChatMessages,
  saveChatMessage,
  saveLogFromExtractedData,
  getDailyFitnessSummary,
} from '../db/database';
import { sendChatMessageToCoach } from './gemini';
import { savePhotoLocally } from './storage';
import { ChatMessage } from '../types/fitness';

let isProcessing = false;
const listeners = new Set<() => void>();

export function isQueueProcessing(): boolean {
  return isProcessing;
}

export function subscribeToQueue(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function notifyListeners(): void {
  listeners.forEach((cb) => {
    try {
      cb();
    } catch {
      // Ignore listener error
    }
  });
}

/**
 * Processes any user messages that have not yet received an AI response
 * and been logged to fitness_logs. This runs safely across screen transitions,
 * background/foreground AppState events, and component mounts.
 */
export async function processPendingMessages(targetSessionId?: string): Promise<number> {
  if (isProcessing) {
    return 0;
  }

  isProcessing = true;
  notifyListeners();

  try {
    const unparsedMessages = await getUnparsedUserMessages(targetSessionId);
    if (!unparsedMessages || unparsedMessages.length === 0) {
      return 0;
    }

    let processedCount = 0;

    for (const userMsg of unparsedMessages) {
      try {
        const sid = userMsg.session_id;
        const allMessages = await getChatMessages(sid);
        const priorMessages = allMessages.filter((m) => m.id < userMsg.id);

        const history = priorMessages
          .slice(-8)
          .map((msg) => ({
            role: msg.sender === 'coach' ? ('model' as const) : ('user' as const),
            text: msg.text || (msg.image_uris?.length || msg.image_uri ? '[Images attached]' : ''),
          }))
          .filter((msg) => Boolean(msg.text && msg.text.trim().length > 0));

        let dailySummary = null;
        try {
          dailySummary = await getDailyFitnessSummary();
        } catch {
          dailySummary = null;
        }

        const images: string[] =
          userMsg.image_uris && userMsg.image_uris.length > 0
            ? userMsg.image_uris
            : userMsg.image_uri
            ? [userMsg.image_uri]
            : [];

        const coachResult = await sendChatMessageToCoach(
          userMsg.text,
          images,
          history,
          dailySummary
        );

        let savedMealPhotoUri: string | null = null;
        let savedProgressPhotoUri: string | null = null;

        if (coachResult.extracted_data?.has_data) {
          if (coachResult.extracted_data.is_progress_photo && images.length > 0) {
            try {
              savedProgressPhotoUri = await savePhotoLocally(images[0], 'progress');
            } catch {
              savedProgressPhotoUri = null;
            }
          } else if (coachResult.extracted_data.nutrition && images.length > 0) {
            try {
              savedMealPhotoUri = await savePhotoLocally(images[0], 'meals');
            } catch {
              savedMealPhotoUri = null;
            }
          }

          await saveLogFromExtractedData(
            coachResult.extracted_data,
            savedMealPhotoUri,
            savedProgressPhotoUri,
            userMsg.text
          );
        }

        await saveChatMessage({
          session_id: sid,
          sender: 'coach',
          text: coachResult.coach_response,
          extracted_data: coachResult.extracted_data,
        });

        processedCount++;
        notifyListeners();
      } catch (err) {
        console.warn('ChatQueue error while processing message:', err);
        // Break out to prevent infinite retry loops in a single pass if network is down
        break;
      }
    }

    return processedCount;
  } finally {
    isProcessing = false;
    notifyListeners();
  }
}
