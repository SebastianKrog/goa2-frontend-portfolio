import { useState } from "react";
import { getAdminToken, setAdminToken } from "../../api/admin";
import styles from "./AdminTokenPrompt.module.css";

interface AdminTokenPromptProps {
  onSaved: () => void;
}

/**
 * Shown when an admin-gated endpoint (replay debugger / bug-report triage)
 * answers 401: the backend is in production mode and wants the
 * GOA2_ADMIN_TOKEN as a bearer token. Saves to localStorage and retries.
 */
export function AdminTokenPrompt({ onSaved }: AdminTokenPromptProps) {
  const [value, setValue] = useState("");
  const hadToken = !!getAdminToken();

  const save = () => {
    if (!value.trim()) return;
    setAdminToken(value);
    onSaved();
  };

  return (
    <div className={styles.box}>
      <p className={styles.text}>
        {hadToken
          ? "The saved admin token was rejected. Enter the current one:"
          : "This server requires an admin token (GOA2_ADMIN_TOKEN) to access the debugger."}
      </p>
      <div className={styles.row}>
        <input
          className={styles.input}
          type="password"
          placeholder="Admin token"
          value={value}
          autoFocus
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
          }}
        />
        <button className={styles.btn} disabled={!value.trim()} onClick={save}>
          Unlock
        </button>
      </div>
    </div>
  );
}
