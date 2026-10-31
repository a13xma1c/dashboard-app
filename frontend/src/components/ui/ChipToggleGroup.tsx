import styles from "./controls.module.css";

export interface ChipOption {
  value: string;
  label: string;
  color?: string;
}

interface Props {
  options: ChipOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  /** Prevent deselecting the last remaining option. */
  minSelected?: number;
  "aria-label": string;
}

/** Multi-select chips, used for toggling chart series. */
export default function ChipToggleGroup({ options, selected, onChange, minSelected = 1, ...rest }: Props) {
  const toggle = (value: string) => {
    if (selected.includes(value)) {
      if (selected.length <= minSelected) return;
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div className={styles.chips} role="group" aria-label={rest["aria-label"]}>
      {options.map((opt) => {
        const active = selected.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            className={[styles.chip, active ? styles.chipActive : ""].join(" ")}
            style={opt.color ? ({ "--chip-color": opt.color } as React.CSSProperties) : undefined}
            onClick={() => toggle(opt.value)}
          >
            <span className={styles.chipDot} aria-hidden="true" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
