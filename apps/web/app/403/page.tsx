import { signOutAction } from "@/lib/auth-actions";

export default function ForbiddenPage() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>403 – Zugriff verweigert</h1>
        <p>
          Ihr Konto ist für die Zeitbrücke-Verwaltung nicht freigeschaltet. Wenn Sie der Meinung
          sind, dass das ein Fehler ist, wenden Sie sich bitte an das Team.
        </p>
        <form action={signOutAction}>
          <button type="submit" className="button button-secondary">
            Abmelden
          </button>
        </form>
      </div>
    </div>
  );
}
