import NetInfo from "@react-native-community/netinfo";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/AppScreen";
import { Body, Button, Card, Chip, EmptyState, Input } from "@/components/ui";
import { chatRepository, profileRepository, type StoredMessage } from "@/database/repositories";
import { aiService } from "@/services/ai";
import { scoreProduct } from "@/features/scoring";
import { productService } from "@/services/product";
import type { ChatContext } from "@/services/contracts";
import { friendlyError } from "@/utils/errors";
import { useTheme } from "@/theme";
import { createId } from "@/utils/id";

export default function ChatScreen() {
  const { colors } = useTheme();
  const { barcode, conversationId: requestedConversationId, prompt } = useLocalSearchParams<{ barcode?: string; conversationId?: string; prompt?: string }>();
  const [conversationId, setConversationId] = useState<string>();
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [input, setInput] = useState(prompt ?? "");
  const [sending, setSending] = useState(false);
  const [offline, setOffline] = useState(false);
  const [contextEnabled, setContextEnabled] = useState(Boolean(barcode));
  const [context, setContext] = useState<ChatContext>();
  const [disclosed, setDisclosed] = useState(false);
  const aborter = useRef<AbortController | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => setOffline(state.isConnected === false));
    if (requestedConversationId) {
      setConversationId(requestedConversationId);
      void chatRepository.messages(requestedConversationId).then(setMessages);
    }
    void Promise.all([barcode ? productService.getByBarcode(barcode) : null, profileRepository.get()])
      .then(([product, profile]) => setContext({
        product: product ? { name: product.name, brand: product.brand, ingredients: product.ingredients, allergens: product.allergens, novaGroup: product.novaGroup, nutritionPer100: product.nutritionPer100 } : undefined,
        profile: profile ? { dietaryPreference: profile.dietaryPreference, allergies: profile.allergies, conditions: profile.conditions, goals: profile.goals } : undefined,
        scoreBreakdown: product ? scoreProduct(product.nutritionPer100, product.novaGroup, profile?.conditions).breakdown : undefined,
      }))
      .catch(() => undefined);
    return () => { unsubscribe(); aborter.current?.abort(); };
  }, [barcode, requestedConversationId]);
  const send = async (retryText?: string) => {
    const text = retryText ?? input.trim();
    if (!text || sending) return;
    if (contextEnabled && !disclosed) { setDisclosed(true); return; }
    const activeConversationId = conversationId ?? await chatRepository.create("New conversation");
    if (!conversationId) setConversationId(activeConversationId);
    const user: StoredMessage = { id: createId(), role: "user", text, createdAt: new Date().toISOString(), aiGenerated: false };
    setMessages((current) => [...current, user]); setInput(""); setSending(true);
    await chatRepository.add(activeConversationId, user);
    if (messages.length === 0) await chatRepository.rename(activeConversationId, text.slice(0, 48));
    aborter.current = new AbortController();
    const history = messages.filter((m) => !m.failed).slice(-6).map((m) => ({ role: m.role, text: m.text }));
    try {
      const reply = await aiService.chat(text, contextEnabled ? context : undefined, aborter.current.signal, history);
      const assistant: StoredMessage = { id: createId(), role: "assistant", text: reply.text, createdAt: new Date().toISOString(), aiGenerated: reply.aiGenerated };
      setMessages((current) => [...current, assistant]);
      await chatRepository.add(activeConversationId, assistant);
    } catch (error) {
      const cancelled = aborter.current?.signal.aborted;
      const failed = { ...user, id: createId(), role: "assistant" as const, text: cancelled ? "Cancelled. Tap retry to ask again." : `${friendlyError(error)} Tap retry.`, failed: true };
      setMessages((current) => [...current, failed]);
    } finally { setSending(false); }
  };
  const clear = () => conversationId && Alert.alert("Delete conversation?", "This removes the messages from this device.", [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: () => void chatRepository.removeConversation(conversationId).then(() => router.replace("/conversations")) },
  ]);
  return <AppScreen scroll={false}>
    <View style={styles.topActions}><Button label="All conversations" variant="secondary" onPress={() => router.push("/conversations")} /></View>
    {offline ? <View style={[styles.banner, { backgroundColor: colors.warning }]}><Text style={{ color: colors.inverse, fontWeight: "700" }}>Offline — local guide remains available</Text></View> : null}
    <View style={styles.context}><Chip label="About this product" selected={contextEnabled && Boolean(context?.product)} onPress={() => setContextEnabled(Boolean(context?.product) && !contextEnabled)} /><Chip label="My goals" selected={contextEnabled && Boolean(context?.profile)} onPress={() => setContextEnabled(Boolean(context?.profile) && !contextEnabled)} /></View>
    {!disclosed && contextEnabled ? <Card><Body>Before sending context</Body><Body muted>NutriScan will share only the selected product's name, ingredients, nutrition values, and/or your dietary settings and goals. It will not send history or identifiers.</Body><Button label="I understand" onPress={() => setDisclosed(true)} /></Card> : null}
    <FlatList
      data={messages}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.messages}
      ListEmptyComponent={<EmptyState title="Ask about your food" message="I can explain common ingredients and NutriScan score factors. Recipes and alternatives require an AI connection." />}
      renderItem={({ item }) => <View style={[styles.message, item.role === "user" ? styles.user : styles.assistant, { backgroundColor: item.role === "user" ? colors.primary : colors.surface }]}>
        <Text style={{ color: item.role === "user" ? colors.inverse : colors.text, lineHeight: 21 }}>{item.text}</Text>
        <Text style={{ color: item.role === "user" ? colors.inverse : colors.muted, fontSize: 11 }}>{new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {item.aiGenerated ? "AI-generated" : item.role === "assistant" ? "Offline guide, not AI-generated" : "You"}</Text>
        {item.failed ? <Pressable accessibilityRole="button" accessibilityLabel="Retry message" onPress={() => void send(messages.findLast((message) => message.role === "user")?.text)}><Text style={{ color: colors.warning, fontWeight: "700" }}>Retry</Text></Pressable> : null}
      </View>}
    />
    {sending ? <View style={styles.sending}><Body muted>Thinking…</Body><Button label="Cancel" variant="secondary" onPress={() => aborter.current?.abort()} /></View> : null}
    <Input label="Message" value={input} onChangeText={setInput} multiline placeholder="Ask about an ingredient or score" />
    <View style={styles.actions}><View style={styles.grow}><Button label="Delete" variant="secondary" onPress={clear} /></View><View style={styles.grow}><Button label="Send" disabled={!input.trim() || sending} onPress={() => void send()} /></View></View>
  </AppScreen>;
}
const styles = StyleSheet.create({ topActions: { alignItems: "flex-start" }, banner: { padding: 10, borderRadius: 10 }, context: { flexDirection: "row", gap: 8 }, messages: { gap: 10, paddingVertical: 8 }, message: { maxWidth: "88%", padding: 14, borderRadius: 16, gap: 6 }, user: { alignSelf: "flex-end", borderBottomRightRadius: 4 }, assistant: { alignSelf: "flex-start", borderBottomLeftRadius: 4 }, sending: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, actions: { flexDirection: "row", gap: 8 }, grow: { flex: 1 } });
