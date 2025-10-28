import { Buffer } from "node:buffer";
import { randomBytes, webcrypto } from "node:crypto";

export interface TokenStore<TToken = unknown> {
  put(userId: string, provider: "google", tokenJson: TToken): Promise<void>;
  get(userId: string, provider: "google"): Promise<TToken | null>;
}

export type AppAesTokenStoreDeps = {
  /**
   * Supabase client (or compatible) used to persist encrypted tokens.
   * Only the methods exercised below are required.
   */
  supabase: {
    from(tableName: string): {
      upsert(values: any, opts?: any): Promise<{ error: { message: string } | null }>;
      select(columns: string): {
        eq(column: string, value: any): any;
        maybeSingle(): Promise<{ data: { sealed_refresh_token: string } | null; error: { message: string } | null }>;
      };
    };
  };
  /**
   * Secret material used for AES-GCM. Key material must be 16/24/32 bytes.
   */
  secret: {
    keyId?: string;
    /**
     * Returns a CryptoKey suitable for AES-GCM encryption/decryption.
     */
    getKey(): Promise<CryptoKey>;
  };
  /**
   * Table name in Supabase. Defaults to `oauth_tokens`.
   */
  table?: string;
  /**
    * Optional clock override (useful for tests).
    */
  now?: () => Date;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function concatBytes(a: Uint8Array, b: Uint8Array) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

async function encryptString(key: CryptoKey, plaintext: string) {
  const iv = randomBytes(12);
  const bytes = encoder.encode(plaintext);
  const cipherBuf = await webcrypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes);
  const sealed = Buffer.from(concatBytes(iv, new Uint8Array(cipherBuf))).toString("base64");
  return sealed;
}

async function decryptString(key: CryptoKey, sealed: string): Promise<string> {
  const blob = Buffer.from(sealed, "base64");
  if (blob.length <= 12) throw new Error("sealed token too short");
  const iv = blob.subarray(0, 12);
  const cipher = blob.subarray(12);
  const plain = await webcrypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
  return decoder.decode(plain);
}

export class AppAesTokenStore<TToken = unknown> implements TokenStore<TToken> {
  private readonly table: string;
  private readonly now: () => Date;

  constructor(private readonly deps: AppAesTokenStoreDeps) {
    this.table = deps.table ?? "oauth_tokens";
    this.now = deps.now ?? (() => new Date());
  }

  async put(userId: string, provider: "google", tokenJson: TToken): Promise<void> {
    if (!userId) throw new Error("userId is required");
    const key = await this.deps.secret.getKey();
    const sealed_refresh_token = await encryptString(key, JSON.stringify(tokenJson));
    const payload = {
      user_id: userId,
      provider,
      sealed_refresh_token,
      updated_at: this.now().toISOString(),
    };
    const { error } = await this.deps.supabase.from(this.table).upsert(payload, { onConflict: "user_id, provider" });
    if (error) {
      throw new Error(`Failed to store token: ${error.message}`);
    }
  }

  async get(userId: string, provider: "google"): Promise<TToken | null> {
    if (!userId) throw new Error("userId is required");
    const query = this.deps.supabase
      .from(this.table)
      .select("sealed_refresh_token")
      .eq("user_id", userId)
      .eq("provider", provider);

    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(`Failed to load token: ${error.message}`);
    if (!data) return null;

    const key = await this.deps.secret.getKey();
    const plaintext = await decryptString(key, data.sealed_refresh_token);
    try {
      return JSON.parse(plaintext) as TToken;
    } catch {
      return plaintext as unknown as TToken;
    }
  }
}

export async function importAesGcmKey(b64Key: string): Promise<CryptoKey> {
  if (!b64Key) throw new Error("Key material is required");
  const raw = Buffer.from(b64Key, "base64");
  if (![16, 24, 32].includes(raw.length)) {
    throw new Error("AES key must be 128/192/256 bits");
  }
  return webcrypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}
