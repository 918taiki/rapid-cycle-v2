// v1 ↔ v2 の CSV 相互運用性テスト。
// シリアライズ出力をゴールデン文字列で固定し、v1 のエクスポート形式と
// 1 バイトも違わないことを保証する（v1 csv.js と同一実装のリグレッション防止）。

import { describe, it, expect } from "vitest";
import { parseCSV, serializeCsv } from "./csv.js";

describe("v1 互換: serializeCsv のゴールデン出力", () => {
  it("基本の 5 フィールド（全て引用符付き）", () => {
    const words = [
      { word: "apple", meaning: "りんご", example_en: "An apple.", example_ja: "りんご。", note: "fruit" },
    ];
    expect(serializeCsv(words)).toBe(
      'word,meaning,example_en,example_ja,note\n"apple","りんご","An apple.","りんご。","fruit"'
    );
  });

  it("欠損フィールドは空文字、引用符は二重化、改行はリテラル \\n、タブは空白", () => {
    const words = [
      { word: "mix", meaning: 'say "hi"', example_en: "a\tb", example_ja: "", note: "l1\nl2" },
    ];
    expect(serializeCsv(words)).toBe(
      'word,meaning,example_en,example_ja,note\n"mix","say ""hi""","a b","","l1\\nl2"'
    );
  });
});

describe("v1 互換: v1 がエクスポートした CSV をそのまま取り込める", () => {
  it("v1 形式（引用符付き・ヘッダあり）をパースできる", () => {
    const v1Csv =
      'word,meaning,example_en,example_ja,note\n' +
      '"comply","従う、準拠する","All branches must comply.","全支店が従う。","comply with の形"\n' +
      '"note","メモ","","",""';
    const parsed = parseCSV(v1Csv);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({
      word: "comply",
      meaning: "従う、準拠する",
      example_en: "All branches must comply.",
      example_ja: "全支店が従う。",
      note: "comply with の形",
    });
    expect(parsed[1]).toMatchObject({ word: "note", meaning: "メモ", example_en: "", example_ja: "", note: "" });
    expect(parsed.every((w) => typeof w.id === "string" && w.id.length > 0)).toBe(true);
  });

  it("エクスポート → インポートの往復でフィールドが保存される", () => {
    const words = [
      { id: "x1", word: "alpha", meaning: "ア,ルファ", example_en: 'the "alpha"', example_ja: "アルファ", note: "first\nsecond" },
    ];
    const [roundTripped] = parseCSV(serializeCsv(words));
    expect(roundTripped.word).toBe("alpha");
    expect(roundTripped.meaning).toBe("ア,ルファ");
    expect(roundTripped.example_en).toBe('the "alpha"');
    expect(roundTripped.note).toBe("first\nsecond");
  });
});
