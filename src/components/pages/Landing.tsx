import { useEffect } from "react";
import { Link } from "react-router-dom";
import styles from "./Landing.module.css";

export function Landing() {
  useEffect(() => {
    document.title = "Guards of Atlantis II";
  }, []);

  return (
    <div className={styles.page}>
      <main className={styles.container}>
        <header className={styles.header}>
          <div className={styles.eyebrow}>Fan-made digital table</div>
          <h1 className={styles.title}>Guards of Atlantis II</h1>
        </header>

        <div className={styles.choices}>
          <Link to="/draft/create" className={`${styles.choice} ${styles.choicePrimary}`}>
            <span className={styles.choiceKicker}>Play with your group</span>
            <span className={styles.choiceTitle}>Create a draft</span>
            <span className={styles.choiceDesc}>
              Share one link, form teams, choose captains, then ban and pick together.
            </span>
            <span className={styles.choiceAction}>Open a lobby <span aria-hidden="true">→</span></span>
          </Link>

          <Link to="/create" className={styles.choice}>
            <span className={styles.choiceKicker}>Set everything yourself</span>
            <span className={styles.choiceTitle}>Manual setup</span>
            <span className={styles.choiceDesc}>
              Build both teams, choose the map and start immediately with player links ready.
            </span>
            <span className={styles.choiceAction}>Set up a game <span aria-hidden="true">→</span></span>
          </Link>
        </div>
      </main>
    </div>
  );
}
