import styles from "./ErrorToast.module.css";

interface Props {
  message: string;
}

export function ErrorToast({ message }: Props) {
  return <div className={styles.toast}>{message}</div>;
}
