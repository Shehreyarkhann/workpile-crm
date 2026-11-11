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
