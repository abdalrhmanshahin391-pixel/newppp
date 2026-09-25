import { mkdir, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Supabase server credentials are required.");
const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
const { data, error } = await supabase
  .from("admin_ai_keys")
  .select("api_key")
  .eq("provider", "openai")
  .in("purpose", ["rita", "shared"])
  .eq("slot", 1)
  .limit(1)
  .maybeSingle();
if (error) throw error;
const apiKey = String(data?.api_key || process.env.OPENAI_API_KEY || "").trim();
if (!apiKey) throw new Error("No protected Rita OpenAI key is available.");

const phrases = {
  ar: ["مم…", "فهمت عليك…", "خليني أشوف…"],
  en: ["Mm-hm…", "Got you…", "Let me think…"],
  de: ["Mhm…", "Verstehe…", "Lass mich kurz überlegen…"],
};
const slug = (value) =>
  value
    .replace(/[^a-z]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
for (const voice of ["marin", "cedar"]) {
  const directory = new URL(`../public/audio/rita-fillers/${voice}/`, import.meta.url);
  await mkdir(directory, { recursive: true });
  for (const [language, values] of Object.entries(phrases)) {
    for (let index = 0; index < values.length; index += 1) {
      const text = values[index];
      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini-tts",
          voice,
          input: text,
          response_format: "pcm",
          instructions:
            "A brief, warm, natural conversational acknowledgement from Rita. Never robotic or theatrical.",
        }),
      });
      if (!response.ok) throw new Error(`OpenAI filler generation failed (${response.status}).`);
      const filename = `${language}-${index + 1}-${slug(language === "ar" ? `arabic-${index + 1}` : text)}.pcm`;
      await writeFile(new URL(filename, directory), Buffer.from(await response.arrayBuffer()));
    }
  }
}
console.log("Generated Rita filler audio for marin and cedar.");
