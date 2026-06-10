import "server-only";

export interface AuditEntry {
  admin_email: string;
  action: string;
  target: string;
  reason?: string;
}

/**
 * Einfaches Audit-Log als strukturiertes Server-Log: wer hat wann was entschieden.
 * Niemals Dokumentinhalte oder signierte URLs loggen.
 */
export function audit(entry: AuditEntry): void {
  console.log(
    JSON.stringify({
      at: new Date().toISOString(),
      admin_email: entry.admin_email,
      action: entry.action,
      target: entry.target,
      ...(entry.reason ? { reason: entry.reason } : {}),
    }),
  );
}
