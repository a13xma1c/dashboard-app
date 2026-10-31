import { useEffect, useId, useRef, useState } from "react";
import { DATE_PRESETS, describeRange, presetForRange, toIsoDate, validateRange } from "../../lib/dates";
import type { DateRangeValue } from "../../lib/dates";
import controls from "./controls.module.css";
import styles from "./DateRangePicker.module.css";

interface Props {
  value: DateRangeValue;
  onChange: (range: DateRangeValue) => void;
}

export default function DateRangePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(() => toIsoDate(value.start));
  const [end, setEnd] = useState(() => toIsoDate(value.end));
  const [error, setError] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const id = useId();

  // Keep the custom inputs in sync when the value changes from outside.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setStart(toIsoDate(value.start));
    setEnd(toIsoDate(value.end));
    setError(null);
  }

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const activePreset = presetForRange(value);

  const applyCustom = () => {
    const range = { start, end };
    const problem = validateRange(range);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    onChange(range);
    setOpen(false);
  };

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
      >
        <CalendarIcon />
        {describeRange(value)}
        <span className={styles.caret} aria-hidden="true">
          ▼
        </span>
      </button>

      {open && (
        <div className={styles.popover} role="dialog" aria-label="Select date range" id={id}>
          <div className={styles.presets}>
            {DATE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={[styles.preset, activePreset?.id === preset.id ? styles.presetActive : ""].join(" ")}
                onClick={() => {
                  onChange(preset.range);
                  setOpen(false);
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <form
            className={styles.custom}
            onSubmit={(e) => {
              e.preventDefault();
              applyCustom();
            }}
          >
            <span className={styles.customTitle}>Custom range</span>
            <div className={styles.fields}>
              <label className={styles.field}>
                Start
                <input type="date" value={start} max={toIsoDate("today")} onChange={(e) => setStart(e.target.value)} />
              </label>
              <label className={styles.field}>
                End
                <input type="date" value={end} max={toIsoDate("today")} onChange={(e) => setEnd(e.target.value)} />
              </label>
            </div>
            {error && (
              <span className={styles.error} role="alert">
                {error}
              </span>
            )}
            <div className={styles.actions}>
              <button type="button" className={controls.button} onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="submit" className={controls.buttonPrimary}>
                Apply
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="2" y="3" width="12" height="11" rx="1.5" />
      <path d="M2 7h12M5.5 1.5v3M10.5 1.5v3" />
    </svg>
  );
}
