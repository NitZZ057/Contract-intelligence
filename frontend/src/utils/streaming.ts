export async function readStreamingText(
  response: Response,
  onChunk: (chunk: string) => void,
): Promise<string> {
  if (!response.body) {
    const text = await response.text();
    onChunk(text);
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let result = "";
  let isComplete = false;

  while (!isComplete) {
    const readResult = await reader.read();
    isComplete = readResult.done;

    if (readResult.value) {
      const chunk = decoder.decode(readResult.value, { stream: !isComplete });
      result += chunk;
      onChunk(chunk);
    }
  }

  const finalChunk = decoder.decode();
  if (finalChunk) {
    result += finalChunk;
    onChunk(finalChunk);
  }

  return result;
}

export function parseJsonFromStream<T>(value: string): T {
  const trimmed = value.trim();
  const candidate = trimmed.startsWith("data:")
    ? trimmed
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.replace(/^data:\s*/, ""))
        .join("")
    : trimmed;

  return JSON.parse(candidate) as T;
}
