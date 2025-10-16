// supabase/functions/_shared/crypto.ts
const b64 = {
    enc: (u8: Uint8Array) => btoa(String.fromCharCode(...u8)),
    dec: (s: string) => new Uint8Array([...atob(s)].map(c => c.charCodeAt(0))),
  };
  function concat(a: Uint8Array, b: Uint8Array) { const o=new Uint8Array(a.length+b.length); o.set(a); o.set(b,a.length); return o; }
  async function getKey() {
    const b64Key = Deno.env.get("TOKENS_KEK_V1");
    if (!b64Key) throw new Error("TOKENS_KEK_V1 missing");
    const raw = b64.dec(b64Key);
    return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt","decrypt"]);
  }
  export async function seal(plaintext: string): Promise<string> {
    const key = await getKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = new TextEncoder().encode(plaintext);
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name:"AES-GCM", iv }, key, data));
    return b64.enc(concat(iv, ct));  // base64(iv || ciphertext)
  }
  export async function open(sealed: string): Promise<string> {
    const key = await getKey();
    const blob = b64.dec(sealed);
    const iv = blob.slice(0,12);
    const ct = blob.slice(12);
    const pt = await crypto.subtle.decrypt({ name:"AES-GCM", iv }, key, ct);
    return new TextDecoder().decode(pt);
  }
  