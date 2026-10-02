/**
 * Parse JSON out of a model response that may be wrapped in code fences
 * or surrounded by prose. Throws if no valid JSON object is found.
 */
export function parseModelJson<T>(text: string): T {
  if (typeof text !== "string" || text.trim() === "") {
    throw new Error("parseModelJson: empty model response");
  }

  let s = text.trim();
  const fence = s.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();

  try {
    return JSON.parse(s) as T;
  } catch {
    // fall through to brace extraction
  }

  const obj = extractFirstObject(s);
  if (obj === null) {
    throw new Error("parseModelJson: no JSON object found in model response");
  }
  try {
    return JSON.parse(obj) as T;
  } catch (err) {
    throw new Error(`parseModelJson: invalid JSON (${(err as Error).message})`);
  }
}

/** Return the first balanced `{...}` substring, respecting JSON strings. */
function extractFirstObject(s: string): string | null {
  const start = s.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}
