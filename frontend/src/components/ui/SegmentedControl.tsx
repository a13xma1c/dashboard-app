import styles from "./controls.module.css";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  "aria-label": string;
}

export default function SegmentedControl<T extends string>({ options, value, onChange, ...rest }: Props<T>) {
  return (
    <div className={styles.segmented} role="radiogroup" aria-label={rest["aria-label"]}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={opt.value === value}
          className={[styles.segment, opt.value === value ? styles.segmentActive : ""].join(" ")}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
