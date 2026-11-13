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

// Third audit: a const/let declared AFTER a top-level early return in a
// component, but referenced by an EFFECT closure created BEFORE the return,
// is a permanent TDZ trap when a render takes the return path (the wpGoTab
// bug, v63: App's globals effect captured `go` from the logged-out render
// scope, where `const go` below `if (!user) return ...` never executed —
// every wpGoTab call then threw "Cannot access 'go' before initialization").
// Only effect closures count: they run even for early-returned renders and
// can register escapes (window globals, listeners). Ordinary JSX handlers
// created in the same render are safe — discarded branches never render.
// Property names and parameter-shadowed identifiers are not references.
let badTdz = 0;
const collectEffectRefs = (node, refs) => {
  const isEscapeCall = (n) => ts.isCallExpression(n) && ts.isIdentifier(n.expression) && (n.expression.text === "useEffect" || n.expression.text === "useLive");
  const walkEffect = (n, shadow) => {
    if ((ts.isArrowFunction(n) || ts.isFunctionExpression(n)) && n !== node) {
      const inner = new Set(shadow);
      for (const p of n.parameters) if (ts.isIdentifier(p.name)) inner.add(p.name.text);
      n.forEachChild(c => walkEffect(c, inner)); return;
    }
    if (ts.isIdentifier(n)) {
      const p = n.parent;
      const isPropName = p && ((ts.isPropertyAssignment(p) || ts.isPropertyAccessExpression(p) || ts.isBindingElement(p) || ts.isVariableDeclaration(p) || ts.isParameter(p) || ts.isFunctionDeclaration(p)) && p.name === n);
      if (!isPropName && !shadow.has(n.text)) refs.add(n.text);
    }
    n.forEachChild(c => walkEffect(c, shadow));
  };
  const find = (n) => {
    if (isEscapeCall(n)) { for (const a of n.arguments) if (ts.isArrowFunction(a) || ts.isFunctionExpression(a)) walkEffect(a, new Set()); return; }
    n.forEachChild(find);
  };
  find(node);
};
const auditTdz = (body, compName) => {
  if (!body || !ts.isBlock(body)) return;
  const stmts = body.statements;
  const retIdx = stmts.findIndex(st => ts.isIfStatement(st) && st.thenStatement && /return/.test(st.thenStatement.getText()));
  if (retIdx === -1) return;
  const refs = new Set();
  for (let i = 0; i < retIdx; i++) collectEffectRefs(stmts[i], refs);
  for (let i = retIdx + 1; i < stmts.length; i++) {
    const st = stmts[i];
    if (!ts.isVariableStatement(st)) continue;
    for (const d of st.declarationList.declarations) {
      if (ts.isIdentifier(d.name) && refs.has(d.name.text)) { badTdz++; console.error(`UI-SCOPE: ${compName}: '${d.name.text}' (line ${line(d.getStart())}) is declared after an early return but captured by an effect closure created before it — on the render path that takes the return, calls throw TDZ. Move the declaration above the return.`); }
    }
  }
};
for (const st of src.statements) {
  if (ts.isFunctionDeclaration(st) && st.name && st.body) auditTdz(st.body, st.name.text);
  if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) if (d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer)) && ts.isIdentifier(d.name)) auditTdz(d.initializer.body, d.name.text);
}
if (badTdz) process.exit(1);
console.log("TDZ early-return check OK (no effect closure captures a post-return declaration)");

// ---------- Audit 4: no React hooks below a top-level early return ----------
// The v18/v64 class: a useState/useEffect/useRef declared after `if (!x) return`
// never runs on the loading render, then runs on the loaded render — React
// throws "rendered more hooks than during the previous render" and the view
// blanks. Vite cannot see it; only AST position can.
let badHooks = 0;
const isReturnIf = (st) => ts.isIfStatement(st) && st.thenStatement && /return/.test(st.thenStatement.getText());
const hookCallsIn = (node, compName, retLine) => {
  const walk = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && /^use[A-Z]/.test(n.expression.text)) { badHooks++; console.error(`UI-SCOPE: ${compName}: hook ${n.expression.text} (line ${line(n.getStart())}) is declared after an early return (line ${retLine}) — it will crash the first data-loaded render. Move all hooks above the return.`); }
    if (ts.isFunctionDeclaration(n) || ts.isArrowFunction(n) || ts.isFunctionExpression(n)) return; // nested scopes have their own rules
    n.forEachChild(walk);
  };
  walk(node);
};
const auditHooks = (body, compName) => {
  if (!body || !ts.isBlock(body)) return;
  const stmts = body.statements;
  const retIdx = stmts.findIndex(isReturnIf);
  if (retIdx === -1) return;
  for (let i = retIdx + 1; i < stmts.length; i++) hookCallsIn(stmts[i], compName, line(stmts[retIdx].getStart()));
};
for (const st of src.statements) {
  if (ts.isFunctionDeclaration(st) && st.name && st.body) auditHooks(st.body, st.name.text);
  if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) if (d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer)) && ts.isIdentifier(d.name)) auditHooks(d.initializer.body, d.name.text);
}
if (badHooks) process.exit(1);
console.log("Hooks-order check OK (no hook declared below an early return)");
