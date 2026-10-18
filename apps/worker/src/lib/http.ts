import type { ZodType } from "zod";
import { ApiError } from "../errors";

/** Reads a JSON body without ever buffering more than `maxBytes`. */
export async function readJson(request: Request, maxBytes: number): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Request body is too large.");
  if (!request.body) throw new ApiError(400, "INVALID_JSON", "A JSON body is required.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Request body is too large.");
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
  try {
    return JSON.parse(new TextDecoder().decode(merged));
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Request body is not valid JSON.");
  }
}

/** Validates input; error details name the failing fields but never echo values. */
export function parse<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const fields = result.error.issues.slice(0, 8).map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
  throw new ApiError(400, "VALIDATION_FAILED", "The request was not valid.", undefined, fields);
}
