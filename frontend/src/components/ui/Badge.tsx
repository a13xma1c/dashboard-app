import type { ReactNode } from "react";
import styles from "./controls.module.css";

export default function Badge({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span className={styles.badge} title={title}>
      {children}
    </span>
  );
}
