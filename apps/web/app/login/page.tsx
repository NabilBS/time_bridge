"use client";

import { useState, type FormEvent } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type LoginStatus = "idle" | "sending" | "sent" | "error";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<LoginStatus>("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: true,
      },
    });

    setStatus(error ? "error" : "sent");
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>
          Zeitbrücke <span style={{ color: "var(--color-gold)" }}>Admin</span>
        </h1>
        <p>
          Bitte melden Sie sich mit Ihrer dienstlichen E-Mail-Adresse an. Sie erhalten einen
          Anmeldelink per E-Mail (Magic Link).
        </p>

        {status === "sent" ? (
          <p className="notice">
            Der Anmeldelink wurde versendet. Bitte prüfen Sie Ihr E-Mail-Postfach und öffnen Sie
            den Link in diesem Browser.
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            {status === "error" ? (
              <p className="form-error" role="alert">
                Die Anmeldung ist fehlgeschlagen. Bitte prüfen Sie die E-Mail-Adresse und
                versuchen Sie es erneut.
              </p>
            ) : null}
            <div className="form-row">
              <label htmlFor="email">E-Mail-Adresse</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <button type="submit" className="button button-primary" disabled={status === "sending"}>
              {status === "sending" ? "Wird gesendet …" : "Anmeldelink senden"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
