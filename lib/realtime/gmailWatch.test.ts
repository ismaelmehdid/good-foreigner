import { describe, it, expect, vi, afterEach } from "vitest";
import { watch, stop, listNewMessageIds, getProfileEmail } from "./gmailWatch";
import { GmailAuthError } from "@/lib/gmail/fetchInbox";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
afterEach(() => vi.unstubAllGlobals());

describe("watch / stop", () => {
  it("watches INBOX on the topic and returns historyId + expiration as numbers", async () => {
    const fetchMock = vi.fn(async () => json({ historyId: "1234", expiration: "1790000000000" }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await watch("tok", "projects/p/topics/t")).toEqual({ historyId: "1234", expiration: 1790000000000 });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://gmail.googleapis.com/gmail/v1/users/me/watch");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      topicName: "projects/p/topics/t",
      labelIds: ["INBOX"],
      labelFilterBehavior: "include",
    });
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("stop POSTs users/me/stop (empty 204 body is fine)", async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(url);
        return new Response(null, { status: 204 });
      }),
    );
    await stop("tok");
    expect(urls[0]).toMatch(/\/users\/me\/stop$/);
  });

  it("getProfileEmail lowercases the mailbox address", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ emailAddress: "Me@Gmail.com" })));
    expect(await getProfileEmail("tok")).toBe("me@gmail.com");
  });
});

describe("listNewMessageIds", () => {
  it("follows pagination, dedupes ids, and returns the latest historyId", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const u = new URL(url);
      expect(u.searchParams.get("historyTypes")).toBe("messageAdded");
      expect(u.searchParams.get("labelId")).toBe("INBOX");
      expect(u.searchParams.get("startHistoryId")).toBe("100");
      if (!u.searchParams.get("pageToken")) {
        return json({
          history: [{ messagesAdded: [{ message: { id: "a", labelIds: ["INBOX"] } }, { message: { id: "b" } }] }],
          nextPageToken: "p2",
          historyId: "150",
        });
      }
      return json({
        history: [
          { messagesAdded: [{ message: { id: "a" } }, { message: { id: "c", labelIds: ["INBOX", "UNREAD"] } }] },
          { messagesAdded: [{ message: { id: "s", labelIds: ["SENT"] } }] },
        ],
        historyId: "160",
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    expect(await listNewMessageIds("tok", "100")).toEqual({ ids: ["a", "b", "c"], historyId: "160", reset: false });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns reset on 404 (history too old)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: { code: 404 } }, 404)));
    expect(await listNewMessageIds("tok", "1")).toEqual({ ids: [], historyId: null, reset: true });
  });

  it("throws GmailAuthError on 401", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({}, 401)));
    await expect(listNewMessageIds("tok", "1")).rejects.toBeInstanceOf(GmailAuthError);
  });
});
