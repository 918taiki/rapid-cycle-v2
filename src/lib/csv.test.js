import { describe, it, expect } from "vitest";
import { parseCSV, serializeCsv } from "./csv.js";

// Strip the generated id so we can compare against the source fields.
const stripIds = words => words.map(w => {
  const copy = { ...w };
  delete copy.id;
  return copy;
});

describe("parseCSV(serializeCsv(words)) round-trip", () => {
  const cases = {
    "quote inside a field": [
      { word: "monitor", meaning: "モニター", example_en: 'a 5" display', example_ja: "5インチの画面", note: 'size: 5"' },
    ],
    "multiple newlines in note": [
      { word: "comply", meaning: "従う", example_en: "They comply.", example_ja: "彼らは従う。", note: "line1\nline2\nline3" },
    ],
    "comma inside a field": [
      { word: "comply", meaning: "従う、準拠する", example_en: "comply, obey", example_ja: "従う、守る", note: "syn: obey, follow" },
    ],
    "empty fields": [
      { word: "abate", meaning: "弱まる", example_en: "", example_ja: "", note: "" },
    ],
    "multiple rows": [
      { word: "alpha", meaning: "アルファ", example_en: "the alpha", example_ja: "アルファ", note: "first" },
      { word: "beta", meaning: "ベータ", example_en: "the beta", example_ja: "ベータ", note: "second" },
    ],
  };

  for (const [name, words] of Object.entries(cases)) {
    it(name, () => {
      const parsed = parseCSV(serializeCsv(words));
      expect(stripIds(parsed)).toEqual(words);
    });
  }
});

describe("header detection", () => {
  it("skips a standard header row", () => {
    const csv = "word,meaning,example_en,example_ja,note\napple,りんご,An apple.,りんご。,fruit";
    const parsed = parseCSV(csv);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].word).toBe("apple");
  });

  it("keeps a first-row word that merely contains 'word' (e.g. wordplay)", () => {
    const csv = "wordplay\t言葉遊び\npun\tだじゃれ";
    const parsed = parseCSV(csv);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].word).toBe("wordplay");
    expect(parsed[0].meaning).toBe("言葉遊び");
  });

  it("does not treat 'meaningful' as a header", () => {
    const csv = "meaningful,意味のある";
    const parsed = parseCSV(csv);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].word).toBe("meaningful");
  });

  it("skips a Japanese-style header (英単語,意味)", () => {
    const csv = "英単語,意味\napple,りんご";
    const parsed = parseCSV(csv);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].word).toBe("apple");
  });
});

describe("legacy format compatibility", () => {
  it("parses tab-separated 2-column data", () => {
    const csv = "apple\tりんご\nbanana\tバナナ";
    const parsed = parseCSV(csv);
    expect(parsed).toHaveLength(2);
    expect(parsed[1]).toMatchObject({ word: "banana", meaning: "バナナ", example_en: "", example_ja: "", note: "" });
  });

  it("parses unquoted comma-separated 5-column data", () => {
    const csv = "apple,りんご,An apple.,りんご。,fruit";
    const parsed = parseCSV(csv);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      word: "apple",
      meaning: "りんご",
      example_en: "An apple.",
      example_ja: "りんご。",
      note: "fruit",
    });
  });
});
