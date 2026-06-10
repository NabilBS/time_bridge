import { BERLIN_DISTRICTS, PARTNER_KIND_LABELS } from "@zeitbruecke/shared";

import type { PartnerLocationRow } from "@/lib/types";

/** Gemeinsame Formularfelder für Anlegen und Bearbeiten (Server-gerendert). */
export function PartnerLocationFields({ location }: { location?: PartnerLocationRow }) {
  return (
    <>
      <div className="form-row">
        <label htmlFor="name">Name *</label>
        <input id="name" name="name" type="text" required maxLength={120} defaultValue={location?.name ?? ""} />
      </div>

      <div className="form-row">
        <label htmlFor="kind">Art *</label>
        <select id="kind" name="kind" required defaultValue={location?.kind ?? ""}>
          <option value="" disabled>
            Bitte wählen …
          </option>
          {Object.entries(PARTNER_KIND_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="form-row">
        <label htmlFor="street">Straße und Hausnummer</label>
        <input
          id="street"
          name="street"
          type="text"
          maxLength={200}
          defaultValue={location?.street ?? ""}
        />
      </div>

      <div className="form-row">
        <label htmlFor="postal_code">Postleitzahl</label>
        <input
          id="postal_code"
          name="postal_code"
          type="text"
          inputMode="numeric"
          maxLength={5}
          defaultValue={location?.postal_code ?? ""}
        />
      </div>

      <div className="form-row">
        <label htmlFor="district">Bezirk *</label>
        <select id="district" name="district" required defaultValue={location?.district ?? ""}>
          <option value="" disabled>
            Bitte wählen …
          </option>
          {BERLIN_DISTRICTS.map((district) => (
            <option key={district} value={district}>
              {district}
            </option>
          ))}
        </select>
      </div>

      <div className="form-row">
        <label htmlFor="lat">Breitengrad</label>
        <input
          id="lat"
          name="lat"
          type="text"
          inputMode="decimal"
          placeholder="z. B. 52.5200"
          defaultValue={location?.lat ?? ""}
        />
      </div>

      <div className="form-row">
        <label htmlFor="lng">Längengrad</label>
        <input
          id="lng"
          name="lng"
          type="text"
          inputMode="decimal"
          placeholder="z. B. 13.4050"
          defaultValue={location?.lng ?? ""}
        />
      </div>

      <div className="form-row">
        <label htmlFor="contact">Kontakt</label>
        <input
          id="contact"
          name="contact"
          type="text"
          maxLength={200}
          placeholder="z. B. Telefonnummer oder E-Mail"
          defaultValue={location?.contact ?? ""}
        />
      </div>

      <div className="form-row form-row-checkbox">
        <input
          id="is_verified"
          name="is_verified"
          type="checkbox"
          defaultChecked={location?.is_verified ?? false}
        />
        <label htmlFor="is_verified">
          Verifiziert (der Ort ist damit in der App für alle sichtbar)
        </label>
      </div>
    </>
  );
}
