import Link from "next/link";
import type { ReactNode } from "react";

import { requireAdmin } from "@/lib/auth";
import { signOutAction } from "@/lib/auth-actions";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();

  return (
    <>
      <header className="site-header">
        <div className="site-header-inner">
          <span className="brand">
            Zeitbrücke <span className="brand-accent">Admin</span>
          </span>
          <nav className="main-nav" aria-label="Hauptnavigation">
            <Link href="/verifizierungen">Verifizierungen</Link>
            <Link href="/meldungen">Meldungen</Link>
            <Link href="/partner-orte">Partner-Orte</Link>
            <Link href="/kennzahlen">Kennzahlen</Link>
          </nav>
          <div className="session">
            <span className="session-email">{admin.email}</span>
            <form action={signOutAction}>
              <button type="submit" className="button button-ghost">
                Abmelden
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="page">{children}</main>
    </>
  );
}
