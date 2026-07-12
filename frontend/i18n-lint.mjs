// ============================================================
//  Frontle — i18n-lint: caza texto de UI hardcodeado (regresión).
//
//  Alta precisión sobre parsear-JSX-con-regex (imposible fiable):
//   A) Texto JSX que contiene ACENTOS latinos (áéíóúñçãõê…). El código JS/TS
//      casi nunca lleva acentos, así que texto acentuado fuera de {…} es casi
//      siempre UI hardcodeada en es/pt/fr — la regresión que nos importa.
//   B) Props visibles (placeholder/aria-label/alt/title) con literal "…".
//   C) Literales dentro de aria-label={ … "texto" … } (ternarios de audio, etc.).
//
//  Límite conocido: NO detecta inglés hardcodeado por heurística (indistinguible
//  de código). La paridad de claves entre idiomas ya la garantiza `tsc`.
//  Uso: node i18n-lint.mjs   (sale con 1 si encuentra algo)
// ============================================================
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const ALLOW = new Set([
  "frontle", "bordy", "minipay", "celo", "privy", "ok", "usdt", "usdc",
  "usdm", "copm", "celoscan", "vercel", "language",
]);
const PROP_ATTRS = ["placeholder", "aria-label", "alt", "title"];
const ACCENT = /[À-ÖØ-öø-ÿ]/; // letras latinas acentuadas

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith(".tsx")) out.push(p);
  }
  return out;
}
function stripComments(src) {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
}
const lineOf = (src, idx) => src.slice(0, idx).split("\n").length;
const words = (s) => (s.match(/[\p{L}]{2,}/gu) || []).filter((w) => !ALLOW.has(w.toLowerCase()));

const findings = [];
for (const file of walk("app")) {
  const src = stripComments(readFileSync(file, "utf-8"));

  // A) Texto JSX con acentos (quitando {expresiones})
  for (const m of src.matchAll(/>([^<>{}]*)</g)) {
    const text = m[1].replace(/&[a-z]+;/gi, " ").trim();
    if (text && ACCENT.test(text) && words(text).length)
      findings.push({ file, line: lineOf(src, m.index), kind: "jsx-text", text });
  }
  // B) Props con literal directo
  for (const attr of PROP_ATTRS) {
    for (const m of src.matchAll(new RegExp(`${attr}\\s*=\\s*"([^"]+)"`, "g")))
      if (words(m[1]).length) findings.push({ file, line: lineOf(src, m.index), kind: attr, text: m[1] });
  }
  // C) Literales de texto dentro de aria-label={ … } (ternarios, etc.)
  for (const m of src.matchAll(/aria-label\s*=\s*\{([^}]*)\}/g))
    for (const lit of m[1].matchAll(/"([^"]+)"/g))
      if (words(lit[1]).length) findings.push({ file, line: lineOf(src, m.index), kind: "aria-expr", text: lit[1] });
}

if (findings.length === 0) {
  console.log("✓ i18n-lint: sin texto de UI hardcodeado.");
  process.exit(0);
}
console.log(`✗ i18n-lint: ${findings.length} posible(s) string(s) hardcodeado(s):\n`);
for (const f of findings) console.log(`  ${f.file}:${f.line}  [${f.kind}]  "${f.text.slice(0, 90)}"`);
console.log("\nMueve estos textos a app/lib/i18n.ts (o añade la marca propia a ALLOW).");
process.exit(1);
