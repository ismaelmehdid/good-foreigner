import { describe, it, expect, vi, afterEach } from "vitest";
import { extractPlainText, fetchInbox, GmailAuthError } from "./fetchInbox";

function b64url(s: string): string {
  return Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

describe("extractPlainText", () => {
  it("decodes a single-part text/plain base64url body", () => {
    const text = "Hello there?\nCan you start work on Monday? Pay is $500/day >> details";
    const out = extractPlainText({ mimeType: "text/plain", body: { data: b64url(text) } });
    expect(out).toBe("Hello there? Can you start work on Monday? Pay is $500/day >> details");
  });

  it("prefers nested text/plain inside multipart/alternative", () => {
    const out = extractPlainText({
      mimeType: "multipart/mixed",
      body: { size: 0 },
      parts: [
        {
          mimeType: "multipart/alternative",
          body: { size: 0 },
          parts: [
            { mimeType: "text/html", body: { data: b64url("<p>HTML version</p>") } },
            { mimeType: "text/plain", body: { data: b64url("Plain   version\r\n here") } },
          ],
        },
        { mimeType: "application/pdf", filename: "invoice.pdf", body: { attachmentId: "abc" } },
      ],
    });
    expect(out).toBe("Plain version here");
  });

  it("falls back to html with tags stripped and entities decoded", () => {
    const html =
      "<html><head><style>p{color:red}</style><script>alert(1)</script></head>" +
      "<body><p>Invoice&nbsp;#42 &amp; W-9</p><br/><div>Due &lt;Friday&gt;</div></body></html>";
    const out = extractPlainText({
      mimeType: "multipart/alternative",
      parts: [{ mimeType: "text/html", body: { data: b64url(html) } }],
    });
    expect(out).toBe("Invoice #42 & W-9 Due <Friday>");
  });

  it("returns empty string when there is no text body", () => {
    expect(extractPlainText({ mimeType: "multipart/mixed", parts: [] })).toBe("");
  });
});

describe("fetchInbox", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }

  it("lists messages, fetches each in full, and maps headers to InboxItems", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const fetchMock = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/messages?")) {
        return json({ messages: [{ id: "m1", threadId: "t1" }, { id: "m2", threadId: "t2" }] });
      }
      if (url.endsWith("/messages/m1?format=full")) {
        return json({
          id: "m1",
          snippet: "snippet one",
          payload: {
            mimeType: "text/plain",
            headers: [
              { name: "From", value: "Recruiter <jobs@example.com>" },
              { name: "subject", value: "Paid gig offer" },
              { name: "Date", value: "Thu, 01 Oct 2026 10:00:00 -0700" },
            ],
            body: { data: b64url("Can you do a paid talk?") },
          },
        });
      }
      if (url.endsWith("/messages/m2?format=full")) {
        return json({
          id: "m2",
          snippet: "only a snippet",
          payload: { mimeType: "multipart/mixed", headers: [{ name: "Subject", value: "No body" }], parts: [] },
        });
      }
      return json({ error: "unexpected" }, 500);
    });
    vi.stubGlobal("fetch", fetchMock);

    const items = await fetchInbox("tok-123", 5);

    const listCall = fetchMock.mock.calls[0];
    expect(String(listCall[0])).toBe(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5&labelIds=INBOX&q=newer_than:30d",
    );
    const init = listCall[1] as RequestInit;
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer tok-123");

    expect(items).toEqual([
      {
        id: "m1",
        source: "email",
        from: "Recruiter <jobs@example.com>",
        subject: "Paid gig offer",
        date: "Thu, 01 Oct 2026 10:00:00 -0700",
        body: "Can you do a paid talk?",
      },
      { id: "m2", source: "email", from: undefined, subject: "No body", date: undefined, body: "only a snippet" },
    ]);
  });

  it("returns [] when the mailbox has no recent messages", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ resultSizeEstimate: 0 })));
    expect(await fetchInbox("tok")).toEqual([]);
  });

  it("throws GmailAuthError on 401", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: { code: 401 } }, 401)));
    await expect(fetchInbox("expired")).rejects.toBeInstanceOf(GmailAuthError);
  });

  it("throws GmailAuthError on 403 from a message fetch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) =>
        String(input).includes("/messages?") ? json({ messages: [{ id: "x" }] }) : json({}, 403),
      ),
    );
    await expect(fetchInbox("tok")).rejects.toBeInstanceOf(GmailAuthError);
  });

  it("throws a plain Error with the status on other failures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({}, 500)));
    const err = await fetchInbox("tok").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(GmailAuthError);
    expect(String((err as Error).message)).toMatch(/500/);
  });

  describe("skipIds", () => {
    function listThen(ids: string[]) {
      return vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("/messages?")) return json({ messages: ids.map((id) => ({ id })) });
        const id = url.match(/\/messages\/([^?]+)\?format=full/)?.[1] ?? "";
        return json({
          id,
          snippet: `snippet ${id}`,
          payload: { mimeType: "text/plain", headers: [{ name: "Subject", value: `S ${id}` }], body: {} },
        });
      });
    }

    it("fetches only ids not in skipIds, keeping list order", async () => {
      const fetchMock = listThen(["a", "b", "c"]);
      vi.stubGlobal("fetch", fetchMock);

      const items = await fetchInbox("tok", 15, new Set(["b"]));

      expect(items.map((i) => i.id)).toEqual(["a", "c"]);
      const urls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(urls[0]).toBe(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=15&labelIds=INBOX&q=newer_than:30d",
      );
      expect(urls.some((u) => u.includes("/messages/b?"))).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("returns [] after only the list call when every id was already seen", async () => {
      const fetchMock = listThen(["a", "b"]);
      vi.stubGlobal("fetch", fetchMock);

      expect(await fetchInbox("tok", 15, new Set(["a", "b"]))).toEqual([]);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("fetches everything when skipIds is empty or omitted", async () => {
      const fetchMock = listThen(["a", "b"]);
      vi.stubGlobal("fetch", fetchMock);
      expect((await fetchInbox("tok", 15, new Set())).map((i) => i.id)).toEqual(["a", "b"]);
      expect((await fetchInbox("tok")).map((i) => i.id)).toEqual(["a", "b"]);
    });
  });
});
