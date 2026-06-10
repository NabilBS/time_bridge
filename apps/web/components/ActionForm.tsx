"use client";

import { useActionState } from "react";
import type { ReactNode } from "react";

import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/types";

type ActionFormProps = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  /** Frage für den Bestätigungsdialog (window.confirm) vor dem Absenden. */
  confirmMessage: string;
  children: ReactNode;
  className?: string;
};

/**
 * Formular-Hülle für Server Actions mit Bestätigungsdialog und Fehleranzeige.
 * Die eigentlichen Felder kommen als (server-gerenderte) Kinder herein.
 */
export function ActionForm({ action, confirmMessage, children, className }: ActionFormProps) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_ACTION_STATE);

  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      {state.error ? (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <fieldset className="action-fieldset" disabled={isPending}>
        {children}
      </fieldset>
    </form>
  );
}
