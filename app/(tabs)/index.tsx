import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import {
  Camera,
  Image as ImageIcon,
  Send,
  Trash2,
  X,
  Zap,
  Sparkles,
  Menu,
  Plus,
  MessageSquare,
} from 'lucide-react-native';
import { LoggedActivityCard } from '../../components/LoggedActivityCard';
import { COLORS } from '../../constants/theme';
import { MealType, ChatMessage, ChatSession } from '../../types/fitness';
import { sendChatMessageToCoach } from '../../services/gemini';
import { savePhotoLocally } from '../../services/storage';
import {
  getChatMessages,
  saveChatMessage,
  clearChatMessages,
  saveLogFromExtractedData,
  createChatSession,
  getChatSessions,
  deleteChatSession,
  updateChatSessionTitle,
  getDailyFitnessSummary,
} from '../../db/database';

export const MEAL_TYPES: MealType[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

const PROMPT_SUGGESTIONS = [
  '🥗 Ate oatmeal & 3 eggs for breakfast',
  '🏋️ Did chest & arms workout for 45 mins',
  '⚖️ Weighed 75.5kg today',
  '🌙 Had chamomile tea & 8 hours sleep',
];

function formatSessionDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return 'Recent';
  }
}

export default function LogScreen(): JSX.Element {
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentSessionTitle, setCurrentSessionTitle] = useState<string>('New Conversation');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const loadSessionsAndMessages = useCallback(async () => {
    try {
      const activeSessions = await getChatSessions();
      setSessions(activeSessions);

      let targetSessionId = currentSessionId;
      if (!targetSessionId) {
        if (activeSessions.length > 0) {
          targetSessionId = activeSessions[0].id;
          setCurrentSessionTitle(activeSessions[0].title);
        } else {
          const newSession = await createChatSession('New Conversation');
          setSessions([newSession]);
          targetSessionId = newSession.id;
          setCurrentSessionTitle(newSession.title);
        }
        setCurrentSessionId(targetSessionId);
      }

      if (targetSessionId) {
        const stored = await getChatMessages(targetSessionId);
        setMessages(stored);
      }
    } catch (err) {
      console.error('Failed to load chat sessions:', err);
    }
  }, [currentSessionId]);

  useEffect(() => {
    loadSessionsAndMessages();
  }, [loadSessionsAndMessages]);

  useFocusEffect(
    useCallback(() => {
      loadSessionsAndMessages();
    }, [loadSessionsAndMessages])
  );

  const handleStartNewSession = async () => {
    try {
      const newSession = await createChatSession('New Conversation');
      setSessions((prev) => [newSession, ...prev]);
      setCurrentSessionId(newSession.id);
      setCurrentSessionTitle(newSession.title);
      setMessages([]);
      setInputText('');
      setAttachedImages([]);
      setIsDrawerOpen(false);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to create new session.');
    }
  };

  const handleSelectSession = async (session: ChatSession) => {
    try {
      setCurrentSessionId(session.id);
      setCurrentSessionTitle(session.title);
      const stored = await getChatMessages(session.id);
      setMessages(stored);
      setIsDrawerOpen(false);
      await Haptics.selectionAsync().catch(() => {});
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to load session.');
    }
  };

  const handleDeleteSession = (sessionId: string) => {
    Alert.alert(
      'Delete Session',
      'Are you sure you want to delete this chat session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteChatSession(sessionId);
              const remaining = sessions.filter((s) => s.id !== sessionId);
              setSessions(remaining);

              if (currentSessionId === sessionId) {
                if (remaining.length > 0) {
                  setCurrentSessionId(remaining[0].id);
                  setCurrentSessionTitle(remaining[0].title);
                  const stored = await getChatMessages(remaining[0].id);
                  setMessages(stored);
                } else {
                  handleStartNewSession();
                }
              }
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete session.');
            }
          },
        },
      ]
    );
  };

  const handleClearCurrentChat = () => {
    Alert.alert(
      'Clear Conversation',
      'Are you sure you want to clear the messages in this chat session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Messages',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsClearing(true);
              if (currentSessionId) {
                await clearChatMessages(currentSessionId);
              } else {
                await clearChatMessages();
              }
              setMessages([]);
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to clear chat history.');
            } finally {
              setIsClearing(false);
            }
          },
        },
      ]
    );
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        const pickRes = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
          allowsMultipleSelection: true,
          selectionLimit: 6,
        });
        if (!pickRes.canceled && pickRes.assets && pickRes.assets.length > 0) {
          const uris = pickRes.assets.map((a) => a.uri).filter(Boolean);
          setAttachedImages((prev) => [...prev, ...uris].slice(0, 6));
        }
        return;
      }
      const res = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        const uri = res.assets[0].uri;
        setAttachedImages((prev) => [...prev, uri].slice(0, 6));
      }
    } catch {
      const pickRes = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: 6,
      });
      if (!pickRes.canceled && pickRes.assets && pickRes.assets.length > 0) {
        const uris = pickRes.assets.map((a) => a.uri).filter(Boolean);
        setAttachedImages((prev) => [...prev, ...uris].slice(0, 6));
      }
    }
  };

  const pickImage = async () => {
    try {
      const pickRes = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: 6,
      });
      if (!pickRes.canceled && pickRes.assets && pickRes.assets.length > 0) {
        const uris = pickRes.assets.map((a) => a.uri).filter(Boolean);
        setAttachedImages((prev) => [...prev, ...uris].slice(0, 6));
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to select image.');
    }
  };

  const removeAttachedImage = (index: number) => {
    setAttachedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSendMessage = async () => {
    const userText = inputText.trim();
    const imagesToSend = [...attachedImages];

    if (!userText && imagesToSend.length === 0) {
      return;
    }
    if (isSending) {
      return;
    }

    let activeSessionId = currentSessionId;
    if (!activeSessionId) {
      const newSession = await createChatSession(userText ? userText.slice(0, 28) : 'Photo Check-in');
      activeSessionId = newSession.id;
      setCurrentSessionId(newSession.id);
      setCurrentSessionTitle(newSession.title);
      setSessions((prev) => [newSession, ...prev]);
    }

    try {
      setIsSending(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

      // Clear input fields immediately
      setInputText('');
      setAttachedImages([]);

      // Optimistically append user message to local state
      const optimisticUserMsg: ChatMessage = {
        id: Date.now(),
        session_id: activeSessionId,
        sender: 'user',
        text: userText,
        image_uri: imagesToSend[0] || null,
        image_uris: imagesToSend,
        extracted_data: null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticUserMsg]);

      // Save user message to SQLite
      await saveChatMessage({
        session_id: activeSessionId,
        sender: 'user',
        text: userText,
        image_uri: imagesToSend[0] || null,
        image_uris: imagesToSend,
      });

      // Update session title if default
      if (messages.length === 0 && userText) {
        const snippet = userText.slice(0, 28);
        updateChatSessionTitle(activeSessionId, snippet).catch(() => {});
        setCurrentSessionTitle(snippet);
      }

      // Build conversation history from recent messages (last 8)
      const history = messages
        .slice(-8)
        .map((msg) => ({
          role: msg.sender === 'coach' ? ('model' as const) : ('user' as const),
          text: msg.text || (msg.image_uris?.length || msg.image_uri ? '[Images attached]' : ''),
        }))
        .filter((msg) => Boolean(msg.text && msg.text.trim().length > 0));

      // Fetch live daily summary for real-time read context
      const dailySummary = await getDailyFitnessSummary().catch(() => null);

      // Query Gemini Coach with live daily summary context
      const coachResult = await sendChatMessageToCoach(userText, imagesToSend, history, dailySummary);

      let savedMealPhotoUri: string | null = null;
      let savedProgressPhotoUri: string | null = null;

      // Update today's 3-meal slot in database
      if (coachResult.extracted_data?.has_data) {
        if (coachResult.extracted_data.is_progress_photo && imagesToSend.length > 0) {
          savedProgressPhotoUri = await savePhotoLocally(imagesToSend[0], 'progress');
        } else if (coachResult.extracted_data.nutrition && imagesToSend.length > 0) {
          savedMealPhotoUri = await savePhotoLocally(imagesToSend[0], 'meals');
        }

        await saveLogFromExtractedData(
          coachResult.extracted_data,
          savedMealPhotoUri,
          savedProgressPhotoUri
        );
      }

      // Save coach message to SQLite
      await saveChatMessage({
        session_id: activeSessionId,
        sender: 'coach',
        text: coachResult.coach_response,
        extracted_data: coachResult.extracted_data,
      });

      // Append coach message to local state
      const coachMsg: ChatMessage = {
        id: Date.now() + 1,
        session_id: activeSessionId,
        sender: 'coach',
        text: coachResult.coach_response,
        image_uri: null,
        image_uris: [],
        extracted_data: coachResult.extracted_data,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, coachMsg]);

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      flatListRef.current?.scrollToEnd({ animated: true });
    } catch (err: any) {
      setInputText(userText);
      setAttachedImages(imagesToSend);
      Alert.alert('Coach Error', err?.message || 'Failed to communicate with Fuel Coach.');
    } finally {
      setIsSending(false);
    }
  };

  const renderMessageItem = ({ item }: { item: ChatMessage }) => {
    const isUser = item.sender === 'user';
    const formattedTime = item.created_at
      ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

    const messageImages = item.image_uris && item.image_uris.length > 0
      ? item.image_uris
      : item.image_uri
      ? [item.image_uri]
      : [];

    if (isUser) {
      return (
        <View style={styles.userMessageRow} testID="user-message-row">
          <View style={styles.userBubble} testID="user-message-bubble">
            {messageImages.length === 1 && (
              <Image
                source={{ uri: messageImages[0] }}
                style={styles.messageImage}
                testID="message-image-preview"
              />
            )}
            {messageImages.length > 1 && (
              <View style={styles.multiImageGrid} testID="multi-message-image-grid">
                {messageImages.map((uri, idx) => (
                  <Image
                    key={idx}
                    source={{ uri }}
                    style={styles.gridImage}
                    testID={`message-image-preview-${idx}`}
                  />
                ))}
              </View>
            )}
            {Boolean(item.text) && (
              <Text style={styles.userMessageText} testID="user-message-text">
                {item.text}
              </Text>
            )}
            {Boolean(formattedTime) && (
              <Text style={styles.timestampUser}>{formattedTime}</Text>
            )}
          </View>
        </View>
      );
    }

    return (
      <View style={styles.coachMessageRow} testID="coach-message-row">
        <View style={styles.coachAvatar}>
          <Zap size={16} color="#000" />
        </View>
        <View style={styles.coachBubble} testID="coach-message-bubble">
          <Text style={styles.coachName}>Fuel Coach</Text>
          <Text style={styles.coachMessageText} testID="coach-message-text">
            {item.text}
          </Text>

          {item.extracted_data?.has_data && (
            <LoggedActivityCard data={item.extracted_data} />
          )}

          {Boolean(formattedTime) && (
            <Text style={styles.timestampCoach}>{formattedTime}</Text>
          )}
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer} testID="empty-chat-state">
      <View style={styles.emptyIconCircle}>
        <Sparkles size={36} color={COLORS.primary} />
      </View>
      <Text style={styles.emptyTitle}>Meet Fuel Coach 🔥</Text>
      <Text style={styles.emptyDescription}>
        Your AI nutrition & physique assistant. Tell me what you ate, update your meals, or log workouts and weight. Everything automatically syncs to your daily slots (Breakfast, Lunch, Dinner)!
      </Text>

      <Text style={styles.suggestionsTitle}>💡 Quick Prompts to Try:</Text>
      <View style={styles.suggestionsContainer}>
        {PROMPT_SUGGESTIONS.map((suggestion, idx) => (
          <TouchableOpacity
            key={idx}
            style={styles.suggestionChip}
            onPress={() => setInputText(suggestion)}
            testID={`suggestion-chip-${idx}`}
          >
            <Text style={styles.suggestionText}>{suggestion}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      testID="log-screen-root"
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={styles.drawerBtn}
          onPress={() => setIsDrawerOpen(true)}
          testID="open-sessions-drawer-btn"
        >
          <Menu size={22} color={COLORS.text} />
        </TouchableOpacity>

        <View style={styles.headerLeft}>
          <Text style={styles.brandTitle} numberOfLines={1}>
            {currentSessionTitle}
          </Text>
          <Text style={styles.brandSubtitle}>Fuel Coach · Real-Time Sync</Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={handleStartNewSession}
            testID="new-chat-header-btn"
          >
            <Plus size={20} color={COLORS.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={handleClearCurrentChat}
            disabled={isClearing || messages.length === 0}
            testID="clear-chat-button"
          >
            <Trash2
              size={18}
              color={messages.length === 0 ? COLORS.textMuted : COLORS.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Sessions Drawer Modal */}
      <Modal
        visible={isDrawerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsDrawerOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.drawerContainer, { paddingTop: insets.top + 10 }]}>
            <View style={styles.drawerHeader}>
              <View style={styles.drawerTitleRow}>
                <MessageSquare size={20} color={COLORS.primary} />
                <Text style={styles.drawerTitle}>Chat Sessions</Text>
              </View>
              <TouchableOpacity
                style={styles.closeDrawerBtn}
                onPress={() => setIsDrawerOpen(false)}
                testID="close-drawer-btn"
              >
                <X size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.newChatDrawerBtn}
              onPress={handleStartNewSession}
              testID="new-chat-drawer-btn"
            >
              <Plus size={18} color="#000" />
              <Text style={styles.newChatDrawerText}>New Chat Session</Text>
            </TouchableOpacity>

            <Text style={styles.sessionsSubheading}>Past 7 Days History</Text>

            <ScrollView style={styles.sessionsList} showsVerticalScrollIndicator={false}>
              {sessions.length === 0 ? (
                <Text style={styles.emptySessionsText}>No active sessions</Text>
              ) : (
                sessions.map((session) => {
                  const isActive = session.id === currentSessionId;
                  return (
                    <TouchableOpacity
                      key={session.id}
                      style={[styles.sessionItem, isActive && styles.sessionItemActive]}
                      onPress={() => handleSelectSession(session)}
                      testID={`session-item-${session.id}`}
                    >
                      <View style={styles.sessionItemContent}>
                        <Text style={[styles.sessionItemTitle, isActive && styles.sessionItemTitleActive]} numberOfLines={1}>
                          {session.title}
                        </Text>
                        <Text style={styles.sessionItemDate}>
                          {formatSessionDate(session.updated_at || session.created_at)}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.deleteSessionBtn}
                        onPress={() => handleDeleteSession(session.id)}
                        testID={`delete-session-${session.id}`}
                      >
                        <Trash2 size={16} color={COLORS.textMuted} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Chat Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessageItem}
        keyExtractor={(item, index) => (item.id ? item.id.toString() : index.toString())}
        contentContainerStyle={[
          styles.messageList,
          messages.length === 0 && styles.emptyListContent,
        ]}
        ListEmptyComponent={renderEmptyState}
        onContentSizeChange={() => {
          if (messages.length > 0) {
            flatListRef.current?.scrollToEnd({ animated: true });
          }
        }}
        testID="chat-messages-list"
      />

      {/* Input Toolbar */}
      <View style={[styles.inputBarContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {attachedImages.length > 0 && (
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={attachedImages}
            keyExtractor={(item, index) => `${item}-${index}`}
            contentContainerStyle={styles.attachedImagesList}
            testID="attached-images-scroll"
            renderItem={({ item, index }) => (
              <View style={styles.attachedImageWrapper} testID={`attached-image-wrapper-${index}`}>
                <Image
                  source={{ uri: item }}
                  style={styles.attachedThumbnail}
                  testID={`attached-image-preview-${index}`}
                />
                <TouchableOpacity
                  style={styles.removeImageBtn}
                  onPress={() => removeAttachedImage(index)}
                  testID={`remove-attached-image-button-${index}`}
                >
                  <X size={14} color="#FFF" />
                </TouchableOpacity>
              </View>
            )}
          />
        )}

        <View style={styles.inputRow}>
          {/* Photo Actions */}
          <TouchableOpacity
            style={styles.mediaButton}
            onPress={takePhoto}
            testID="camera-button"
          >
            <Camera size={22} color={COLORS.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.mediaButton}
            onPress={pickImage}
            testID="gallery-button"
          >
            <ImageIcon size={22} color={COLORS.textSecondary} />
          </TouchableOpacity>

          {/* Text Input */}
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Tell Fuel Coach what you ate or trained..."
            placeholderTextColor={COLORS.textMuted}
            multiline
            maxLength={1000}
            testID="chat-input"
          />

          {/* Send Button */}
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() && attachedImages.length === 0) || isSending
                ? styles.sendButtonDisabled
                : null,
            ]}
            onPress={handleSendMessage}
            disabled={(!inputText.trim() && attachedImages.length === 0) || isSending}
            testID="send-button"
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#000" testID="sending-indicator" />
            ) : (
              <Send size={18} color="#000" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: COLORS.background,
    gap: 12,
  },
  drawerBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  headerLeft: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  brandSubtitle: {
    fontSize: 12,
    color: COLORS.primary,
    marginTop: 1,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  drawerContainer: {
    width: '85%',
    maxWidth: 340,
    height: '100%',
    backgroundColor: '#0F172A',
    borderRightWidth: 1,
    borderRightColor: COLORS.cardBorder,
    paddingHorizontal: 18,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  drawerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  closeDrawerBtn: {
    padding: 6,
  },
  newChatDrawerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    marginBottom: 20,
  },
  newChatDrawerText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '700',
  },
  sessionsSubheading: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  sessionsList: {
    flex: 1,
  },
  emptySessionsText: {
    color: COLORS.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 20,
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  sessionItemActive: {
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    borderColor: COLORS.primary,
  },
  sessionItemContent: {
    flex: 1,
    marginRight: 10,
  },
  sessionItemTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 3,
  },
  sessionItemTitleActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  sessionItemDate: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  deleteSessionBtn: {
    padding: 6,
  },
  messageList: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },
  suggestionsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    alignSelf: 'flex-start',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  suggestionsContainer: {
    width: '100%',
    gap: 8,
  },
  suggestionChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  suggestionText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '500',
  },
  userMessageRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 14,
  },
  userBubble: {
    maxWidth: '82%',
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderColor: COLORS.primary,
    borderWidth: 1,
    borderRadius: 18,
    borderBottomRightRadius: 4,
    padding: 12,
  },
  userMessageText: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 22,
  },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 12,
    marginBottom: 8,
  },
  multiImageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
    maxWidth: 220,
  },
  gridImage: {
    width: 100,
    height: 90,
    borderRadius: 8,
  },
  timestampUser: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 10,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  coachMessageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 10,
  },
  coachAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  coachBubble: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: 18,
    borderTopLeftRadius: 4,
    padding: 14,
  },
  coachName: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  coachMessageText: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 22,
  },
  timestampCoach: {
    color: COLORS.textMuted,
    fontSize: 10,
    marginTop: 6,
  },
  inputBarContainer: {
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  attachedImagesList: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 8,
  },
  attachedImageWrapper: {
    position: 'relative',
    marginRight: 6,
  },
  attachedThumbnail: {
    width: 58,
    height: 58,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  removeImageBtn: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  mediaButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    color: COLORS.text,
    fontSize: 14,
    textAlignVertical: 'center',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
});

