import { randomBytes } from "node:crypto";
import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import { AppAesTokenStore, importAesGcmKey } from "../src/token_store";

class InMemorySupabase {
  private rows = new Map<string, any>();

  from(tableName: string) {
    if (tableName !== "oauth_tokens") throw new Error("unexpected table " + tableName);
    const self = this;
    return {
      upsert(values: any) {
        self.rows.set(`${values.user_id}:${values.provider}`, values);
        return Promise.resolve({ error: null });
      },
      select() {
        const filters: Record<string, any> = {};
        return {
          eq(column: string, value: any) {
            filters[column] = value;
            return this;
          },
          async maybeSingle() {
            for (const row of self.rows.values()) {
              if (Object.entries(filters).every(([col, val]) => row[col] === val)) {
                return { data: { sealed_refresh_token: row.sealed_refresh_token }, error: null };
              }
            }
            return { data: null, error: null };
          }
        };
      }
    };
  }
}

describe("AppAesTokenStore", () => {
  it("round-trips an OAuth token payload", async () => {
    const base64Key = Buffer.from(randomBytes(32)).toString("base64");
    const key = await importAesGcmKey(base64Key);
    const supabase = new InMemorySupabase();
    const store = new AppAesTokenStore<{ refresh_token: string }>({
      supabase,
      secret: { getKey: async () => key },
      now: () => new Date("2024-01-01T00:00:00Z")
    });

    const token = { refresh_token: "refresh_123", access_token: "ignored" };
    await store.put("user-1", "google", token);

    const fetched = await store.get("user-1", "google");
    expect(fetched).toEqual(token);
  });
});
