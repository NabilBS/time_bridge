import { BERLIN_DISTRICTS } from "@zeitbruecke/shared";

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
        <input
          id="kind"
          name="kind"
          type="text"
          required
          maxLength={80}
          placeholder="z. B. Mehrgenerationenhaus, Stadtteilzentrum"
          defaultValue={location?.kind ?? ""}
        />
      </div>

      <div className="form-row">
        <label htmlFor="address">Adresse *</label>
        <input id="address" name="address" type="text" required maxLength={200} defaultValue={location?.address ?? ""} />
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
        <label htmlFor="latitude">Breitengrad (Latitude)</label>
        <input
          id="latitude"
          name="latitude"
          type="text"
          inputMode="decimal"
          placeholder="z. B. 52.5200"
          defaultValue={location?.latitude ?? ""}
        />
      </div>

      <div className="form-row">
        <label htmlFor="longitude">Längengrad (Longitude)</label>
        <input
          id="longitude"
          name="longitude"
          type="text"
          inputMode="decimal"
          placeholder="z. B. 13.4050"
          defaultValue={location?.longitude ?? ""}
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
