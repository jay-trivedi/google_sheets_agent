import { loadSync } from "https://deno.land/std@0.224.0/dotenv/mod.ts";

loadSync({ envPath: ".env.local", export: true });
