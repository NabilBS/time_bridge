import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionForm } from "@/components/ActionForm";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PartnerLocationRow } from "@/lib/types";
import { deletePartnerLocationAction, updatePartnerLocationAction } from "../actions";
import { PartnerLocationFields } from "../PartnerLocationFields";

export const dynamic = "force-dynamic";

export default async function PartnerOrtBearbeitenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("partner_locations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw new Error(`Partner-Ort konnte nicht geladen werden: ${error.message}`);
  }
  if (!data) {
    notFound();
  }
  const location = data as PartnerLocationRow;

  return (
    <>
      <Link href="/partner-orte" className="back-link">
        ← Zurück zur Liste
      </Link>
      <h1>Partner-Ort bearbeiten: {location.name}</h1>

      <div className="action-grid">
        <div className="action-card" style={{ maxWidth: 560 }}>
          <h3>Stammdaten</h3>
          <ActionForm
            action={updatePartnerLocationAction}
            confirmMessage="Möchten Sie die Änderungen an diesem Partner-Ort speichern?"
          >
            <input type="hidden" name="id" value={location.id} />
            <PartnerLocationFields location={location} />
            <button type="submit" className="button button-primary">
              Speichern
            </button>
          </ActionForm>
        </div>

        <div className="action-card">
          <h3>Löschen</h3>
          <p className="form-hint">
            Der Partner-Ort wird dauerhaft entfernt und ist in der App nicht mehr sichtbar.
          </p>
          <ActionForm
            action={deletePartnerLocationAction}
            confirmMessage={`Möchten Sie den Partner-Ort „${location.name}" wirklich löschen?`}
          >
            <input type="hidden" name="id" value={location.id} />
            <button type="submit" className="button button-danger">
              Löschen
            </button>
          </ActionForm>
        </div>
      </div>
    </>
  );
}
