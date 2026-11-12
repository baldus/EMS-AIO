"use client";

import { useActionState } from "react";
import { initialFormState, type FormState } from "@/app/(app)/organizations/form-mapping";

interface Props {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  id: string;
  version: number;
  archived: boolean;
}

export function ArchiveButton({ action, id, version, archived }: Props) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (
          !archived &&
          !window.confirm("Archive this organization? It will be hidden from lists.")
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="intent" value={archived ? "restore" : "archive"} />
      <button type="submit" className={archived ? "secondary" : "danger"} disabled={pending}>
        {archived ? "Restore" : "Archive"}
      </button>
      {state.error ? (
        <span className="field-error" role="alert" style={{ marginLeft: 8 }}>
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
