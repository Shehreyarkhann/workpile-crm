// Build guard: a component declared INSIDE another component but referenced
// outside it compiles to a free global and explodes at render (the InboxQueue
// bug, v8-v25). This AST audit fails the build if that pattern ever returns.
import ts from "typescript"; import fs from "node:fs";
const file = "src/main.tsx";
const text = fs.readFileSync(file, "utf8");
const src = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const line = (n) => src.getLineAndCharacterOfPosition(n).line + 1;
const nested = [];
const isFnLike = (n) => ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n) || ts.isClassDeclaration(n);
function walk(node, stack) {
  if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name && stack.length) {
    const p = stack[stack.length - 1];
    nested.push({ name: node.name.text, at: line(node.getStart()), parent: (p.name && p.name.text) || "(anon)", range: [line(p.getStart()), line(p.getEnd())] });
  }
  const push = isFnLike(node); if (push) stack.push(node);
  node.forEachChild(c => walk(c, stack));
  if (push) stack.pop();
}
walk(src, []);
const lines = text.split("\n"); let bad = 0;
for (const d of nested) {
  const uses = [];
  lines.forEach((l, i) => { if (new RegExp("\\b" + d.name + "\\b").test(l) && (i + 1 < d.range[0] || i + 1 > d.range[1])) uses.push(i + 1); });
  if (uses.length) { bad++; console.error(`UI-SCOPE: ${d.name} (line ${d.at}) is nested inside ${d.parent} but used outside it at line(s) ${uses.join(", ")} — hoist it to module level.`); }
}
if (bad) process.exit(1);
console.log(`UI scope check OK (${nested.length} nested declarations, none used outside their parent)`);

// Second audit: an effect callback must never return a Promise — React treats
// the return value as the cleanup function and calls it on unmount, which
// throws "x is not a function" and blanks the app (the JobChat bug, v27).
// Flags expression-bodied helpers (`const f = () => api(...)`) passed to
// useEffect, and inline `useEffect(() => api(...))` forms.
const effectLines = lines.map((l, i) => [l, i + 1]).filter(([l]) => /useEffect\(/.test(l));
let badFx = 0;
for (const [l, n] of effectLines) {
  if (/useEffect\(\s*\(\s*\)\s*=>\s*(api|fetch)\(/.test(l)) { badFx++; console.error(`UI-SCOPE: line ${n}: useEffect returns a promise directly — wrap the call in a block body.`); }
  const m = l.match(/useEffect\(\s*([A-Za-z_$][\w$]*)\s*[,\)]/);
  if (m) {
    const def = new RegExp(`const ${m[1]} = \\(\\) => (api|fetch)\\(`);
    if (lines.some(x => def.test(x))) { badFx++; console.error(`UI-SCOPE: line ${n}: useEffect(${m[1]}) — ${m[1]} is an expression-bodied async helper, so the effect returns a promise. Give it a block body.`); }
  }
}
if (badFx) process.exit(1);
console.log("Effect-hygiene check OK (no effect returns a promise)");
