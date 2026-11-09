// Workpile — native-lite e-signature (§9.3/§26 legal: ESIGN/UETA evidence)
// A proposal gets a signed link (unguessable token). Signing records an evidence
// certificate: document hash at signing time, signer identity, consent, timestamp,
// IP + user agent. Double-signing is rejected; any post-sign proposal edit changes
// the version, which invalidates the link's document hash for the new version.
import { createHash, randomBytes } from "node:crypto";
import { db, uid, now } from "./db.ts";
import { emitEvent } from "./integrations.ts";

export function docHash(p: any): string {
  return createHash("sha256").update(JSON.stringify({ id: p.id, version: p.version, line_items: p.line_items, total: p.total })).digest("hex");
}

export function ensureSignToken(proposalId: string): string | null {
  const p = db.prepare("SELECT * FROM proposals WHERE id=?").get(proposalId) as any;
  if (!p) return null;
  if (p.sign_token) return p.sign_token;
  const token = randomBytes(24).toString("base64url");
  db.prepare("UPDATE proposals SET sign_token=? WHERE id=?").run(token, proposalId);
  db.prepare("INSERT INTO signatures (id,proposal_id,workspace_id,token,doc_hash,created_at) VALUES (?,?,?,?,?,?)")
    .run(uid("sig"), proposalId, p.workspace_id, token, docHash(p), now());
  return token;
}

export function getByToken(token: string): any | null {
  const s = db.prepare("SELECT * FROM signatures WHERE token=?").get(token) as any;
  if (!s) return null;
  const proposal = db.prepare("SELECT * FROM proposals WHERE id=?").get(s.proposal_id) as any;
  const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(proposal.lead_id) as any;
  const contact = db.prepare("SELECT * FROM contacts WHERE id=?").get(lead.contact_id) as any;
  const ws = db.prepare("SELECT * FROM workspaces WHERE id=?").get(proposal.workspace_id) as any;
  return { signature: s, proposal, lead, contact, workspace: ws };
}

export function sign(token: string, input: { signer_name: string; signer_email: string; typed_signature: string; consent: boolean; ip?: string; user_agent?: string }): { ok: boolean; error?: string; certificate?: any } {
  const ctx = getByToken(token);
  if (!ctx) return { ok: false, error: "invalid_link" };
  const { signature: s, proposal } = ctx;
  if (s.signed_at) return { ok: false, error: "already_signed" };
  if (!input.consent) return { ok: false, error: "consent_required" };
  if (!input.signer_name || !input.typed_signature) return { ok: false, error: "name_and_signature_required" };
  if (input.typed_signature.trim().toLowerCase() !== input.signer_name.trim().toLowerCase()) return { ok: false, error: "signature_must_match_name" };
  // document integrity: the hash recorded when the link was issued must match today's doc
  if (docHash(proposal) !== s.doc_hash) return { ok: false, error: "document_changed_since_link_issued" };
  const signedAt = now();
  db.prepare("UPDATE signatures SET signer_name=?, signer_email=?, typed_signature=?, consent=1, ip=?, user_agent=?, signed_at=? WHERE id=?")
    .run(input.signer_name, input.signer_email || "", input.typed_signature, input.ip || "", input.user_agent || "", signedAt, s.id);
  db.prepare("UPDATE proposals SET status='signed', signed_at=? WHERE id=?").run(signedAt, proposal.id);
  emitEvent(proposal.workspace_id, "proposal.signed", { lead_id: proposal.lead_id, proposal_id: proposal.id, signer: input.signer_name });
  const certificate = { signature_id: s.id, proposal_id: proposal.id, doc_hash: s.doc_hash, signer: input.signer_name, signed_at: signedAt, evidence: "ESIGN/UETA consent recorded; typed signature matched signer name; document hash verified at signing" };
  return { ok: true, certificate };
}
