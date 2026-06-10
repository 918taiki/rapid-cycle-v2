// GAS 同期ペイロードの v1 互換性テスト。
// action 名と data フィールドの構造を固定する。

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createGasClient, buildDeckPayload, buildMetaPayload, postToGas } from "./gasClient.js";

const URL = "https://script.google.com/macros/s/xxx/exec";

function mockFetch(responseBody) {
  const fn = vi.fn(async () => ({ text: async () => JSON.stringify(responseBody) }));
  globalThis.fetch = fn;
  return fn;
}

function sentPayload(fetchMock, callIdx = 0) {
  return JSON.parse(fetchMock.mock.calls[callIdx][1].body);
}

describe("buildDeckPayload (v1 互換)", () => {
  it("{ v: 2, deck, stats } 構造で、デッキ所属単語の stats のみ同梱する", () => {
    const deck = { id: "d1", name: "TOEIC", words: [{ id: "w1", word: "a" }, { id: "w2", word: "b" }], folderId: null, order: 0 };
    const stats = {
      w1: { seen: 3, correct: 2, correctWithoutPeek: 1, log: [] },
      other: { seen: 9, correct: 9, correctWithoutPeek: 9, log: [] },
    };
    const payload = buildDeckPayload(deck, stats);
    expect(payload.v).toBe(2);
    expect(payload.deck).toEqual(deck);
    expect(payload.stats).toEqual({ w1: stats.w1 });
  });

  it("id がない旧単語は word をキーに stats を引く", () => {
    const deck = { id: "d1", name: "x", words: [{ word: "legacy" }] };
    const stats = { legacy: { seen: 1, correct: 1, correctWithoutPeek: 0, log: [] } };
    expect(buildDeckPayload(deck, stats).stats).toEqual({ legacy: stats.legacy });
  });
});

describe("buildMetaPayload (v1 互換)", () => {
  it("{ v: 2, updatedAt, folders } 構造", () => {
    const folders = [{ id: "f1", name: "英語", order: 0 }];
    const payload = buildMetaPayload(folders);
    expect(payload.v).toBe(2);
    expect(payload.folders).toBe(folders);
    expect(() => new Date(payload.updatedAt).toISOString()).not.toThrow();
  });
});

describe("createGasClient: action 名と通信仕様", () => {
  let client;
  beforeEach(() => {
    client = createGasClient(URL);
  });

  it("updateDeck", async () => {
    const fetchMock = mockFetch({ ok: true, deckId: "d1" });
    await client.updateDeck({ id: "d1", name: "x", words: [] }, {});
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(URL);
    expect(init.method).toBe("POST");
    expect(init.redirect).toBe("follow");
    expect(init.headers["Content-Type"]).toBe("text/plain;charset=utf-8");
    const payload = sentPayload(fetchMock);
    expect(payload.action).toBe("updateDeck");
    expect(payload.data).toMatchObject({ v: 2, deck: { id: "d1" } });
  });

  it("updateMeta", async () => {
    const fetchMock = mockFetch({ ok: true });
    await client.updateMeta([{ id: "f1", name: "F", order: 0 }]);
    const payload = sentPayload(fetchMock);
    expect(payload.action).toBe("updateMeta");
    expect(payload.data.v).toBe(2);
    expect(payload.data.folders).toHaveLength(1);
  });

  it("deleteDeck はトップレベルに deckId を置く", async () => {
    const fetchMock = mockFetch({ ok: true, deckId: "d1" });
    await client.deleteDeck("d1");
    expect(sentPayload(fetchMock)).toEqual({ action: "deleteDeck", deckId: "d1" });
  });

  it("listDecks / getDeckSummaries / getMeta / getDeck / getSummary", async () => {
    const fetchMock = mockFetch({ ok: true, deckIds: ["a"], summaries: [], data: { v: 2 }, summary: {} });
    await client.listDecks();
    await client.getDeckSummaries(["a", "b"]);
    await client.getMeta();
    await client.getDeck("a");
    await client.getSummary();
    expect(sentPayload(fetchMock, 0)).toEqual({ action: "listDecks" });
    expect(sentPayload(fetchMock, 1)).toEqual({ action: "getDeckSummaries", deckIds: ["a", "b"] });
    expect(sentPayload(fetchMock, 2)).toEqual({ action: "getMeta" });
    expect(sentPayload(fetchMock, 3)).toEqual({ action: "getDeck", deckId: "a" });
    expect(sentPayload(fetchMock, 4)).toEqual({ action: "getSummary" });
  });

  it("getDeckSummaries は空配列なら通信しない", async () => {
    const fetchMock = mockFetch({ ok: true });
    const out = await client.getDeckSummaries([]);
    expect(out).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("postToGas のレスポンス処理", () => {
  it("ok: false はエラーメッセージ付きで throw する", async () => {
    mockFetch({ ok: false, error: "unknown action: x" });
    await expect(postToGas(URL, { action: "x" })).rejects.toThrow("unknown action: x");
  });

  it("JSON の前後にゴミがあっても {} 部分を抽出できる", async () => {
    globalThis.fetch = vi.fn(async () => ({
      text: async () => '<html>junk</html>{"ok":true,"deckIds":[]}trailer',
    }));
    const res = await postToGas(URL, { action: "listDecks" });
    expect(res.ok).toBe(true);
  });
});
