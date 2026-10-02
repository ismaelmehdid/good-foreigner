import { describe, it, expect } from "vitest";
import { parseModelJson } from "./json";

describe("parseModelJson", () => {
  it("parses plain JSON", () => {
    expect(parseModelJson<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
  });

  it("parses JSON inside ```json fences", () => {
    const text = '```json\n{"relevant": true, "category": "employment", "reason": "job offer"}\n```';
    expect(parseModelJson(text)).toEqual({ relevant: true, category: "employment", reason: "job offer" });
  });

  it("parses JSON inside bare ``` fences", () => {
    expect(parseModelJson('```\n{"ok": false}\n```')).toEqual({ ok: false });
  });

  it("parses JSON preceded by prose", () => {
    const text = 'Sure! Here is the result:\n{"relevant": false, "category": "other", "reason": "dinner"}';
    expect(parseModelJson(text)).toEqual({ relevant: false, category: "other", reason: "dinner" });
  });

  it("parses JSON followed by prose and handles braces inside strings", () => {
    const text = 'Result: {"reason": "uses {curly} braces", "n": {"x": 2}} hope this helps }';
    expect(parseModelJson(text)).toEqual({ reason: "uses {curly} braces", n: { x: 2 } });
  });

  it("throws on invalid text", () => {
    expect(() => parseModelJson("I cannot help with that.")).toThrow();
  });

  it("throws on malformed JSON", () => {
    expect(() => parseModelJson('{"a": 1,')).toThrow();
  });
});
