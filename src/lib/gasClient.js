// Google Apps Script バックアップ API クライアント。
// ペイロード構造（action 名・data フィールド）は v1 と完全互換であり、
// 同一の GAS エンドポイント（gas/Code.gs）をそのまま利用できる。
//
// 通信仕様（v1 と同一）:
//   - POST / redirect: follow / Content-Type: text/plain;charset=utf-8
//     （text/plain にすることで CORS プリフライトを回避する）
//   - レスポンスは JSON テキスト。{ ok: true, ... } 以外はエラー扱い

import { statsKey } from "./memory.js";

function extractJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    // GAS がリダイレクト HTML 等を挟むケースに備えて {} 部分を抜き出す
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return null;
}

export async function postToGas(url, payload, signal) {
  const res = await fetch(url, {
    method: "POST",
    redirect: "follow",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
    signal,
  });
  const text = await res.text();
  const parsed = extractJson(text);
  if (!parsed || !parsed.ok) throw new Error(parsed?.error || "request failed");
  return parsed;
}

/** デッキ 1 つ分のアップロードペイロード（v1 互換: { v: 2, deck, stats }） */
export function buildDeckPayload(deck, stats) {
  const deckStats = {};
  for (const word of deck.words) {
    const key = statsKey(word);
    if (stats[key]) {
      deckStats[key] = stats[key];
    }
  }
  return { v: 2, deck: { ...deck }, stats: deckStats };
}

/** meta.json のペイロード（v1 互換: { v: 2, updatedAt, folders }） */
export function buildMetaPayload(folders) {
  return { v: 2, updatedAt: new Date().toISOString(), folders };
}

/** GAS Web アプリ URL に紐づく API クライアントを生成する */
export function createGasClient(url) {
  if (!url) return null;
  return {
    updateDeck: (deck, stats, signal) =>
      postToGas(url, { action: "updateDeck", data: buildDeckPayload(deck, stats) }, signal),

    updateMeta: (folders, signal) =>
      postToGas(url, { action: "updateMeta", data: buildMetaPayload(folders) }, signal),

    deleteDeck: (deckId, signal) =>
      postToGas(url, { action: "deleteDeck", deckId }, signal),

    listDecks: async (signal) => {
      const res = await postToGas(url, { action: "listDecks" }, signal);
      return res.deckIds || [];
    },

    getDeckSummaries: async (deckIds, signal) => {
      if (deckIds.length === 0) return [];
      const res = await postToGas(url, { action: "getDeckSummaries", deckIds }, signal);
      return res.summaries || [];
    },

    getMeta: async (signal) => {
      const res = await postToGas(url, { action: "getMeta" }, signal);
      return res.data;
    },

    getDeck: async (deckId, signal) => {
      const res = await postToGas(url, { action: "getDeck", deckId }, signal);
      return res.data;
    },

    getSummary: async (signal) => {
      const res = await postToGas(url, { action: "getSummary" }, signal);
      return res.summary;
    },
  };
}
