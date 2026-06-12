import { REPORT_REASONS, type Role } from "@zeitbruecke/shared";

export const ROLE_LABELS: Record<Role, string> = {
  senior: "Zeit schenken",
  family: "Familie",
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role as Role] ?? role;
}

export function reportReasonLabel(reason: string): string {
  const match = REPORT_REASONS.find((entry) => entry.id === reason);
  return match ? match.label : reason;
}
