// Groq uses OpenAI-compatible SSE. Only visible answer text belongs on the board.
export async function readModelStream(response: Response, preview: (text: string) => void) {
  if (!response.body) throw new Error("Missing model response");
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let text = "";
  let finish: string | null = null;
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += value ?? "";
      const lines = buffer.split("\n");
      buffer = done ? "" : lines.pop()!;
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") return { text, finish };
        if (!data) continue;
        const packet = JSON.parse(data);
        if (packet.error) throw new Error("Model stream failed");
        const choice = packet.choices?.[0];
        if (typeof choice?.delta?.content === "string") {
          text += choice.delta.content;
          preview(text);
        }
        if (choice?.finish_reason) finish = choice.finish_reason;
      }
      if (done) {
        if (!finish) throw new Error("Incomplete model stream");
        return { text, finish };
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
