// Provider-independent LLM layer (v17). The CRM never hardwires a vendor: tools and the
// orchestrator talk to this interface. Anthropic is the primary provider, OpenAI is supported
// with the same contract, and "rules" is the deterministic fallback when no key is configured —
// callers must label rules output as such (no fake AI). Keys: per-workspace (stored server-side,
// never returned by any DTO) or platform env fallback.
import { db } from "./db.ts";

export interface LlmToolDef { name: string; description: string; parameters: Record<string, any> }
export interface LlmCall { id: string; name: string; args: any }
export interface LlmResult { text: string; calls: LlmCall[]; usage: { in: number; out: number }; model: string }
export interface LlmProvider { kind: string; model: string; chat: (o: { system: string; messages: any[]; tools?: LlmToolDef[]; maxTokens?: number }) => Promise<LlmResult> }
// Neutral loop turns (v49): {role:"user", content} legacy · {role:"assistant", text?, calls?} ·
// {role:"tool", results:[{id, content}]} — each provider translates to its wire format below.
export function toAnthropicMessages(msgs: any[]): any[] {
  return msgs.map(m => {
    if (m.role === "assistant") { const blocks: any[] = []; if (m.text) blocks.push({ type: "text", text: m.text }); for (const c of m.calls || []) blocks.push({ type: "tool_use", id: c.id, name: c.name, input: c.args || {} }); return { role: "assistant", content: blocks.length ? blocks : "" }; }
    if (m.role === "tool") return { role: "user", content: (m.results || []).map((r: any) => ({ type: "tool_result", tool_use_id: r.id, content: String(r.content) })) };
    return { role: "user", content: m.content ?? m.text ?? "" };
  });
}
export function toOpenAIMessages(msgs: any[]): any[] {
  const out: any[] = [];
  for (const m of msgs) {
    if (m.role === "assistant") { out.push({ role: "assistant", content: m.text || "", ...(m.calls?.length ? { tool_calls: m.calls.map((c: any) => ({ id: c.id, type: "function", function: { name: c.name, arguments: JSON.stringify(c.args || {}) } })) } : {}) }); continue; }
    if (m.role === "tool") { for (const r of m.results || []) out.push({ role: "tool", tool_call_id: r.id, content: String(r.content) }); continue; }
    out.push({ role: "user", content: m.content ?? m.text ?? "" });
  }
  return out;
}

const TIMEOUT = 30000;

class AnthropicProvider implements LlmProvider {
  kind = "anthropic"; model: string; key: string; wsId: string | null;
  constructor(key: string, model: string, wsId?: string | null) { this.key = key; this.model = model || "claude-sonnet-5-5"; this.wsId = wsId || null; }
  async chat(o: any): Promise<LlmResult> {
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", signal: AbortSignal.timeout(TIMEOUT),
      headers: { "x-api-key": this.key, "anthropic-version": "2023-06-01", "Content-Type": "application/json", ...(this.wsId ? { "anthropic-workspace-id": this.wsId } : {}) },
      body: JSON.stringify({ model: this.model, max_tokens: o.maxTokens || 2048, system: o.system, messages: toAnthropicMessages(o.messages), tools: (o.tools || []).map((t: LlmToolDef) => ({ name: t.name, description: t.description, input_schema: t.parameters })) }) });
    if (!r.ok) throw new Error(`anthropic ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const j: any = await r.json();
    let text = ""; const calls: LlmCall[] = [];
    for (const b of j.content || []) { if (b.type === "text") text += b.text; if (b.type === "tool_use") calls.push({ id: b.id, name: b.name, args: b.input || {} }); }
    return { text, calls, usage: { in: j.usage?.input_tokens || 0, out: j.usage?.output_tokens || 0 }, model: j.model || this.model };
  }
}

class OpenAIProvider implements LlmProvider {
  kind = "openai"; model: string; key: string;
  constructor(key: string, model: string) { this.key = key; this.model = model || "gpt-5"; }
  async chat(o: any): Promise<LlmResult> {
    const r = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", signal: AbortSignal.timeout(TIMEOUT),
      headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.model, max_tokens: o.maxTokens || 2048, messages: [{ role: "system", content: o.system }, ...toOpenAIMessages(o.messages)], tools: (o.tools || []).map((t: LlmToolDef) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } })) }) });
    if (!r.ok) throw new Error(`openai ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const j: any = await r.json();
    const msg = j.choices?.[0]?.message || {};
    const calls: LlmCall[] = (msg.tool_calls || []).map((c: any) => { let args: any = {}; try { args = JSON.parse(c.function?.arguments || "{}"); } catch { args = {}; } return { id: c.id, name: c.function?.name, args }; });
    return { text: msg.content || "", calls, usage: { in: j.usage?.prompt_tokens || 0, out: j.usage?.completion_tokens || 0 }, model: j.model || this.model };
  }
}

export interface ProviderStatus { kind: string; model: string | null; configured: boolean; source: "workspace" | "env" | "none"; label: string; anthropic_workspace_id: string | null }
export function providerStatus(wsId: string): ProviderStatus {
  const w = db.prepare("SELECT llm_provider, llm_model, llm_api_key, llm_workspace_id FROM workspaces WHERE id=?").get(wsId) as any;
  if (w?.llm_api_key) return { kind: w.llm_provider || "anthropic", model: w.llm_model || null, configured: true, source: "workspace", label: `${w.llm_provider || "anthropic"} (workspace key)`, anthropic_workspace_id: w.llm_workspace_id || null };
  if (process.env.ANTHROPIC_API_KEY) return { kind: "anthropic", model: process.env.WORKPILE_LLM_MODEL || "claude-sonnet-5-5", configured: true, source: "env", label: "anthropic (platform key)", anthropic_workspace_id: null };
  if (process.env.OPENAI_API_KEY) return { kind: "openai", model: process.env.WORKPILE_LLM_MODEL || "gpt-5", configured: true, source: "env", label: "openai (platform key)", anthropic_workspace_id: null };
  return { kind: "rules", model: null, configured: false, source: "none", label: "rules — no AI provider connected", anthropic_workspace_id: null };
}

export function getProvider(wsId: string): LlmProvider | null {
  const w = db.prepare("SELECT llm_provider, llm_model, llm_api_key, llm_workspace_id FROM workspaces WHERE id=?").get(wsId) as any;
  if (w?.llm_api_key) { const kind = w.llm_provider || "anthropic"; return kind === "openai" ? new OpenAIProvider(w.llm_api_key, w.llm_model) : new AnthropicProvider(w.llm_api_key, w.llm_model, w.llm_workspace_id); }
  if (process.env.ANTHROPIC_API_KEY) return new AnthropicProvider(process.env.ANTHROPIC_API_KEY, process.env.WORKPILE_LLM_MODEL || "claude-sonnet-5-5");
  if (process.env.OPENAI_API_KEY) return new OpenAIProvider(process.env.OPENAI_API_KEY, process.env.WORKPILE_LLM_MODEL || "gpt-5");
  return null;
}
