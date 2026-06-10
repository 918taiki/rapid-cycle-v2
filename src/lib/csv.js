// CSV serialization / parsing for decks.
// serializeCsv(words) and parseCSV(text) are designed to round-trip:
// parseCSV(serializeCsv(words)) reproduces the original fields (a fresh id is assigned).

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

const CSV_HEADER = "word,meaning,example_en,example_ja,note";

// Header keywords matched against the first column only (exact match, case-insensitive).
const HEADER_FIRST_COL = ["word", "english", "英単語"];

function serializeField(value) {
  // Order: ① tab -> space, ② " -> "", ③ newlines -> literal "\n", ④ wrap in quotes
  const escaped = String(value ?? "")
    .replace(/\t/g, " ")
    .replace(/"/g, '""')
    .replace(/\r\n/g, "\\n")
    .replace(/\n/g, "\\n");
  return `"${escaped}"`;
}

export function serializeCsv(words) {
  const rows = words.map(w =>
    [w.word, w.meaning, w.example_en || "", w.example_ja || "", w.note || ""]
      .map(serializeField)
      .join(",")
  );
  return [CSV_HEADER, ...rows].join("\n");
}

// Split a single comma-separated line, honoring quotes and "" escaping.
function splitCsvLine(line) {
  const parts = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote: emit one literal " and skip the next char.
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  parts.push(current.trim());
  return parts;
}

function firstColumn(line) {
  const raw = line.includes("\t") ? line.split("\t")[0] : line.split(",")[0];
  return raw.replace(/"/g, "").trim().toLowerCase();
}

export function parseCSV(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  // Header detection: only the first column of the first line, exact match.
  const hasHeader = HEADER_FIRST_COL.includes(firstColumn(lines[0]));
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const restore = s => s.replace(/\\n/g, "\n");

  return dataLines.map(line => {
    const parts = line.includes("\t")
      ? line.split("\t").map(s => s.trim())
      : splitCsvLine(line);

    if (parts.length >= 5) {
      return { id: genId(), word: restore(parts[0]), meaning: restore(parts[1]), example_en: restore(parts[2]), example_ja: restore(parts[3]), note: restore(parts[4]) };
    } else if (parts.length >= 4) {
      return { id: genId(), word: restore(parts[0]), meaning: restore(parts[1]), example_en: restore(parts[2]), example_ja: restore(parts[3]), note: "" };
    } else if (parts.length >= 2) {
      return { id: genId(), word: restore(parts[0]), meaning: restore(parts[1]), example_en: "", example_ja: "", note: "" };
    }
    return null;
  }).filter(Boolean);
}
