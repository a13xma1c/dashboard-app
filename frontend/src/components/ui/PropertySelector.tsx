import { useState } from "react";
import styles from "./PropertySelector.module.css";

interface Props {
  value: string;
  onChange: (id: string) => void;
  compact?: boolean;
}

/** Input for the GA4 property ID. Applies on Enter or via the button. */
export default function PropertySelector({ value, onChange, compact = false }: Props) {
  const [draft, setDraft] = useState(value);

  // Reset the draft when the applied value changes from outside.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setDraft(value);
  }

  const dirty = draft.trim() !== value;

  const apply = () => {
    const next = draft.trim();
    if (next) onChange(next);
  };

  return (
    <form
      className={[styles.form, compact ? styles.compact : ""].join(" ")}
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
    >
      <label className={styles.label} htmlFor="property-id">
        GA4 Property ID
      </label>
      <input
        id="property-id"
        className={styles.input}
        placeholder="e.g. 123456789"
        value={draft}
        inputMode="numeric"
        onChange={(e) => setDraft(e.target.value)}
      />
      <button type="submit" className={styles.apply} disabled={!draft.trim() || !dirty}>
        Apply
      </button>
    </form>
  );
}
