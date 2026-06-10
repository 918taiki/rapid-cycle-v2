// 汎用ユーティリティ（純粋関数のみ）

/** Fisher–Yates シャッフル（元配列は変更しない） */
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** v1 互換のユニーク ID（時刻 base36 + ランダム 6 文字） */
export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

/** ISO 日時文字列を「3分前」「2日前」のような相対表記にする */
export function formatRelativeDate(isoString) {
  if (!isoString) return "";
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "たった今";
  if (mins < 60) return `${mins}分前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}日前`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}週間前`;
  const months = Math.floor(days / 30);
  return `${months}ヶ月前`;
}

/**
 * 例文中の出題単語（と語尾変化 5 文字まで）をハイライト用に分割する。
 * 戻り値は split の結果配列。マッチ部分は奇数インデックスに現れる。
 * 文や単語が空のときは sentence をそのまま返す。
 */
export function highlightWord(sentence, word) {
  if (!sentence || !word) return sentence;
  const base = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${base}\\w{0,5})`, "gi");
  return sentence.split(regex);
}
