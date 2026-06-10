import Link from "next/link";

import { ActionForm } from "@/components/ActionForm";
import { createPartnerLocationAction } from "../actions";
import { PartnerLocationFields } from "../PartnerLocationFields";

export default function PartnerOrtNeuPage() {
  return (
    <>
      <Link href="/partner-orte" className="back-link">
        ← Zurück zur Liste
      </Link>
      <h1>Neuen Partner-Ort anlegen</h1>

      <div className="action-card" style={{ maxWidth: 560 }}>
        <ActionForm
          action={createPartnerLocationAction}
          confirmMessage="Möchten Sie diesen Partner-Ort anlegen?"
        >
          <PartnerLocationFields />
          <button type="submit" className="button button-primary">
            Anlegen
          </button>
        </ActionForm>
      </div>
    </>
  );
}
