import type { Product, UserProfile } from "@/types/models";
import type { ScoreBreakdown } from "@/features/scoring";
import type { SyncReport } from "@/features/sync/engine";

export type ServiceErrorCode =
  | "NOT_CONFIGURED" | "UNAVAILABLE" | "UNAUTHORIZED" | "INVALID_KEY" | "RATE_LIMIT" | "OFFLINE" | "STORAGE_LIMIT";

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: ServiceErrorCode; message: string };

export interface ProductService {
  getByBarcode(barcode: string, signal?: AbortSignal): Promise<Product>;
  search(query: string, signal?: AbortSignal): Promise<Product[]>;
}

export type ChatContext = {
  product?: Pick<Product, "name" | "ingredients" | "nutritionPer100"> & Partial<Pick<Product, "brand" | "allergens" | "novaGroup">>;
  profile?: Pick<UserProfile, "dietaryPreference" | "allergies" | "conditions" | "goals">;
  scoreBreakdown?: ScoreBreakdown[];
};
export type ChatTurn = { role: "user" | "assistant"; text: string };

export type ChatReply = { text: string; aiGenerated: boolean; needsConnection?: boolean };

export interface AIService {
  chat(message: string, context?: ChatContext, signal?: AbortSignal, history?: ChatTurn[]): Promise<ChatReply>;
  recipe(prompt: string, signal?: AbortSignal): Promise<ChatReply>;
  explainScore(breakdown: ScoreBreakdown[], signal?: AbortSignal): Promise<ChatReply>;
  suggestAlternatives(product: Product, signal?: AbortSignal): Promise<ChatReply>;
}

export interface AuthService {
  /** Creates a cloud account and returns its one-time account key. */
  register(): Promise<ServiceResult<{ accountKey: string }>>;
  signIn(accountKey: string): Promise<ServiceResult<null>>;
  signOut(): Promise<ServiceResult<null>>;
  deleteAccount(): Promise<ServiceResult<null>>;
}

export interface SyncService {
  sync(): Promise<ServiceResult<SyncReport>>;
}
