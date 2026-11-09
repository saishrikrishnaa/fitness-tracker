import { processPendingMessages, isQueueProcessing, subscribeToQueue } from '../services/chatQueue';
import * as database from '../db/database';
import * as gemini from '../services/gemini';
import * as storage from '../services/storage';
import { ChatMessage, CoachAnalysisResponse } from '../types/fitness';

jest.mock('../db/database', () => ({
  getUnparsedUserMessages: jest.fn(),
  getChatMessages: jest.fn(),
  saveChatMessage: jest.fn(),
  saveLogFromExtractedData: jest.fn(),
  getDailyFitnessSummary: jest.fn(),
}));

jest.mock('../services/gemini', () => ({
  sendChatMessageToCoach: jest.fn(),
}));

jest.mock('../services/storage', () => ({
  savePhotoLocally: jest.fn(),
}));

describe('ChatQueue Background Processing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 0 when no unparsed messages are pending', async () => {
    (database.getUnparsedUserMessages as jest.Mock).mockResolvedValueOnce([]);
    const count = await processPendingMessages();
    expect(count).toBe(0);
    expect(gemini.sendChatMessageToCoach).not.toHaveBeenCalled();
  });

  it('processes pending unparsed user messages, saves log, and stores coach response', async () => {
    const unparsedMsg: ChatMessage = {
      id: 101,
      session_id: 'session-1',
      sender: 'user',
      text: 'Went for a morning run 5k',
      image_uri: null,
      extracted_data: null,
      created_at: '2026-11-09T08:00:00Z',
    };

    (database.getUnparsedUserMessages as jest.Mock).mockResolvedValueOnce([unparsedMsg]);
    (database.getChatMessages as jest.Mock).mockResolvedValueOnce([unparsedMsg]);
    (database.getDailyFitnessSummary as jest.Mock).mockResolvedValueOnce(null);

    const mockCoachResponse: CoachAnalysisResponse = {
      coach_response: 'Great 5k morning run! That is a solid cardio session.',
      extracted_data: {
        has_data: true,
        action: 'create',
        is_new_log: true,
        workout: {
          workout_notes: 'Morning run 5k',
          duration_mins: 30,
        },
        nutrition: null,
      },
    };

    (gemini.sendChatMessageToCoach as jest.Mock).mockResolvedValueOnce(mockCoachResponse);
    (database.saveLogFromExtractedData as jest.Mock).mockResolvedValueOnce(1);
    (database.saveChatMessage as jest.Mock).mockResolvedValueOnce(102);

    let notified = false;
    const unsub = subscribeToQueue(() => {
      notified = true;
    });

    const count = await processPendingMessages('session-1');
    expect(count).toBe(1);

    expect(gemini.sendChatMessageToCoach).toHaveBeenCalledWith(
      'Went for a morning run 5k',
      [],
      [],
      null
    );

    expect(database.saveLogFromExtractedData).toHaveBeenCalledWith(
      mockCoachResponse.extracted_data,
      null,
      null,
      'Went for a morning run 5k'
    );

    expect(database.saveChatMessage).toHaveBeenCalledWith({
      session_id: 'session-1',
      sender: 'coach',
      text: mockCoachResponse.coach_response,
      extracted_data: mockCoachResponse.extracted_data,
    });

    expect(notified).toBe(true);
    unsub();
  });

  it('gracefully handles errors without throwing and resets queue state', async () => {
    const unparsedMsg: ChatMessage = {
      id: 103,
      session_id: 'session-1',
      sender: 'user',
      text: 'Had an apple',
      image_uri: null,
      extracted_data: null,
      created_at: '2026-11-09T09:00:00Z',
    };

    (database.getUnparsedUserMessages as jest.Mock).mockResolvedValueOnce([unparsedMsg]);
    (database.getChatMessages as jest.Mock).mockResolvedValueOnce([unparsedMsg]);
    (gemini.sendChatMessageToCoach as jest.Mock).mockRejectedValueOnce(new Error('Network offline'));

    const count = await processPendingMessages('session-1');
    expect(count).toBe(0);
    expect(isQueueProcessing()).toBe(false);
  });
});
