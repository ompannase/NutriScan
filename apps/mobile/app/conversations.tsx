import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View, type GestureResponderEvent } from "react-native";
import { AppScreen } from "@/components/AppScreen";
import { Body, Button, Card, EmptyState, ErrorState, Loading, ScreenTitle } from "@/components/ui";
import { chatRepository, type StoredConversation } from "@/database/repositories";
import { useTheme } from "@/theme";

export default function ConversationsScreen() {
  const { colors } = useTheme();
  const [conversations, setConversations] = useState<StoredConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    void chatRepository.conversations()
      .then(setConversations)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);
  useFocusEffect(load);
  const remove = (conversation: StoredConversation) => Alert.alert(
    "Delete conversation?",
    "This removes the messages from this device.",
    [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void chatRepository.removeConversation(conversation.id).then(load) },
    ],
  );
  return <AppScreen>
    <ScreenTitle eyebrow="Stored on this device">Conversations</ScreenTitle>
    <Button label="New conversation" onPress={() => router.push("/chat")} />
    {loading ? <Loading /> : error ? <ErrorState message="Your conversations could not be loaded." retry={load} /> : conversations.length === 0 ? <EmptyState title="No conversations yet" message="Start a conversation to ask about ingredients, scores, or nutrition basics." /> : conversations.map((conversation) =>
      <Card key={conversation.id} onPress={() => router.push({ pathname: "/chat", params: { conversationId: conversation.id } })}>
        <View style={styles.row}>
          <View style={styles.copy}>
            <Body>{conversation.title}</Body>
            <Body muted>{conversation.lastMessage ?? "No messages yet"}</Body>
            <Body muted>{conversation.messageCount} {conversation.messageCount === 1 ? "message" : "messages"} · {new Date(conversation.lastMessageAt ?? conversation.createdAt).toLocaleDateString()}</Body>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${conversation.title}`} hitSlop={12} onPress={(event: GestureResponderEvent) => { event.stopPropagation(); remove(conversation); }}>
            <Text style={[styles.delete, { color: colors.danger }]}>Delete</Text>
          </Pressable>
        </View>
      </Card>,
    )}
  </AppScreen>;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  copy: { flex: 1, gap: 4 },
  delete: { fontWeight: "700" },
});
