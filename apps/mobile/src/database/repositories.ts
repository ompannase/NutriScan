import type { MealEntry, Product, UserProfile } from "@/types/models";
import { createId } from "@/utils/id";
import { getDatabase } from "./index";

export const profileRepository = {
  async get(): Promise<UserProfile | null> {
    const row = await (await getDatabase()).getFirstAsync<{ data: string }>("SELECT data FROM user_profile WHERE id=1");
    return row ? JSON.parse(row.data) as UserProfile : null;
  },
  async save(profile: UserProfile) {
    await (await getDatabase()).runAsync(
      "INSERT OR REPLACE INTO user_profile(id,data,updated_at) VALUES(1,?,?)",
      JSON.stringify(profile), new Date().toISOString(),
    );
  },
};

export const productRepository = {
  async getByBarcode(barcode: string): Promise<Product | null> {
    const row = await (await getDatabase()).getFirstAsync<{ data: string }>("SELECT data FROM products WHERE barcode=?", barcode);
    return row ? JSON.parse(row.data) as Product : null;
  },
  async save(product: Product) {
    await (await getDatabase()).runAsync(
      "INSERT OR REPLACE INTO products(id,barcode,data,retrieved_at) VALUES(?,?,?,?)",
      product.id, product.barcode ?? null, JSON.stringify(product), product.retrievedAt,
    );
  },
  async recordScan(productId: string) {
    await (await getDatabase()).runAsync(
      "INSERT INTO scan_history(product_id,scanned_at) VALUES(?,?)", productId, new Date().toISOString(),
    );
  },
  async recent(limit = 20): Promise<Product[]> {
    const rows = await (await getDatabase()).getAllAsync<{ data: string }>(
      "SELECT p.data FROM scan_history s JOIN products p ON p.id=s.product_id ORDER BY s.scanned_at DESC LIMIT ?", limit,
    );
    return rows.map((row) => JSON.parse(row.data) as Product);
  },
};

export const nutritionRepository = {
  async entries(localDate: string): Promise<MealEntry[]> {
    const rows = await (await getDatabase()).getAllAsync<{ data: string }>(
      "SELECT e.data FROM meal_entries e JOIN meals m ON m.id=e.meal_id WHERE m.local_date=?", localDate,
    );
    return rows.map((row) => JSON.parse(row.data) as MealEntry);
  },
  async hydration(localDate: string): Promise<number> {
    const row = await (await getDatabase()).getFirstAsync<{ total: number | null }>(
      "SELECT SUM(amount_ml) total FROM hydration_entries WHERE local_date=?", localDate,
    );
    return row?.total ?? 0;
  },
  async entriesBetween(startDate: string, endDate: string): Promise<MealEntry[]> {
    const rows = await (await getDatabase()).getAllAsync<{ data: string }>(
      "SELECT e.data FROM meal_entries e JOIN meals m ON m.id=e.meal_id WHERE m.local_date BETWEEN ? AND ? ORDER BY m.local_date",
      startDate,
      endDate,
    );
    return rows.map((row) => JSON.parse(row.data) as MealEntry);
  },
  async addEntry(entry: MealEntry) {
    const db = await getDatabase();
    const mealId = `${entry.date}:${entry.meal}`;
    await db.withTransactionAsync(async () => {
      await db.runAsync("INSERT OR IGNORE INTO meals(id,local_date,meal_type) VALUES(?,?,?)", mealId, entry.date, entry.meal);
      await db.runAsync("INSERT OR REPLACE INTO meal_entries(id,meal_id,product_id,data) VALUES(?,?,?,?)", entry.id, mealId, entry.productId, JSON.stringify(entry));
    });
  },
  async deleteEntry(id: string) {
    await (await getDatabase()).runAsync("DELETE FROM meal_entries WHERE id=?", id);
  },
  async addWater(localDate: string, amountMl: number) {
    const id = createId();
    await (await getDatabase()).runAsync(
      "INSERT INTO hydration_entries(id,local_date,amount_ml,created_at) VALUES(?,?,?,?)",
      id, localDate, amountMl, new Date().toISOString(),
    );
    return id;
  },
  async undoWater(localDate: string) {
    await (await getDatabase()).runAsync(
      "DELETE FROM hydration_entries WHERE id=(SELECT id FROM hydration_entries WHERE local_date=? ORDER BY created_at DESC LIMIT 1)",
      localDate,
    );
  },
};

export const favoriteRepository = {
  async ids(): Promise<string[]> {
    const rows = await (await getDatabase()).getAllAsync<{ product_id: string }>("SELECT product_id FROM favorites ORDER BY created_at DESC");
    return rows.map((row) => row.product_id);
  },
  async has(productId: string) {
    return Boolean(await (await getDatabase()).getFirstAsync("SELECT 1 FROM favorites WHERE product_id=?", productId));
  },
  async toggle(productId: string) {
    const db = await getDatabase();
    if (await this.has(productId)) await db.runAsync("DELETE FROM favorites WHERE product_id=?", productId);
    else await db.runAsync("INSERT INTO favorites(product_id,created_at) VALUES(?,?)", productId, new Date().toISOString());
  },
};

export type StoredMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  aiGenerated: boolean;
  failed?: boolean;
};

export type StoredConversation = {
  id: string;
  title: string;
  createdAt: string;
  lastMessage?: string;
  lastMessageAt?: string;
  messageCount: number;
};

export const chatRepository = {
  async create(title: string) {
    const id = createId();
    await (await getDatabase()).runAsync("INSERT INTO conversations(id,title,created_at) VALUES(?,?,?)", id, title, new Date().toISOString());
    return id;
  },
  async messages(conversationId: string): Promise<StoredMessage[]> {
    const rows = await (await getDatabase()).getAllAsync<{ data: string }>("SELECT data FROM chat_messages WHERE conversation_id=? ORDER BY created_at", conversationId);
    return rows.map((row) => JSON.parse(row.data) as StoredMessage);
  },
  async conversations(): Promise<StoredConversation[]> {
    const rows = await (await getDatabase()).getAllAsync<{
      id: string;
      title: string;
      created_at: string;
      last_message?: string;
      last_message_at?: string;
      message_count: number;
    }>(
      `SELECT c.id, c.title, c.created_at,
        (SELECT json_extract(data, '$.text') FROM chat_messages WHERE conversation_id=c.id ORDER BY created_at DESC LIMIT 1) last_message,
       (SELECT created_at FROM chat_messages WHERE conversation_id=c.id ORDER BY created_at DESC LIMIT 1) last_message_at,
        (SELECT COUNT(*) FROM chat_messages WHERE conversation_id=c.id) message_count
       FROM conversations c
       ORDER BY COALESCE(
         (SELECT MAX(m.created_at) FROM chat_messages m WHERE m.conversation_id=c.id),
         c.created_at
       ) DESC`,
    );
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      lastMessage: row.last_message,
      lastMessageAt: row.last_message_at,
      messageCount: row.message_count,
    }));
  },
  async rename(conversationId: string, title: string) {
    await (await getDatabase()).runAsync("UPDATE conversations SET title=? WHERE id=?", title, conversationId);
  },
  async add(conversationId: string, message: StoredMessage) {
    await (await getDatabase()).runAsync(
      "INSERT INTO chat_messages(id,conversation_id,data,created_at) VALUES(?,?,?,?)",
      message.id, conversationId, JSON.stringify(message), message.createdAt,
    );
  },
  async removeConversation(conversationId: string) {
    await (await getDatabase()).runAsync("DELETE FROM conversations WHERE id=?", conversationId);
  },
};
