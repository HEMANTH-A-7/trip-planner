// Minimal Server-Sent-Events frame parser for a fetch() response body.
// Each event is `data: <json>\n\n`; this doesn't handle the full SSE spec
// (event:/id:/retry: fields, comments) since the streaming route only ever
// sends bare `data:` frames - no need for more than that.
export async function* parseSSE(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop(); // last chunk may be an incomplete frame
      for (const frame of frames) {
        const line = frame.split("\n").find((l) => l.startsWith("data: "));
        if (!line) continue;
        yield JSON.parse(line.slice("data: ".length));
      }
    }
  } finally {
    reader.releaseLock();
  }
}
