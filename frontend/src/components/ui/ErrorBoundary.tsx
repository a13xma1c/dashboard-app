import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import styles from "./ErrorBoundary.module.css";

interface Props {
  children: ReactNode;
  /** Changing this resets the boundary (e.g. the current route). */
  resetKey?: string;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  error: Error | null;
  /** resetKey the error was captured under — a different key clears it. */
  errorKey?: string;
}

/** Catches render errors in a page so one broken widget can't blank the whole app. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (state.error && state.errorKey === undefined) return { errorKey: props.resetKey };
    if (state.error && state.errorKey !== props.resetKey) return { error: null, errorKey: undefined };
    return null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
    if (!this.props.onError) console.error("Dashboard page crashed:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className={styles.container} role="alert">
        <h2 className={styles.title}>Something went wrong rendering this page.</h2>
        <p className={styles.message}>{this.state.error.message}</p>
        <button type="button" className={styles.button} onClick={() => this.setState({ error: null, errorKey: undefined })}>
          Try again
        </button>
      </div>
    );
  }
}
