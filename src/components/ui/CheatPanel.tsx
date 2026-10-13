import { useState } from "react";
import type { GameView } from "../../types/game";
import styles from "./CheatPanel.module.css";
import { useLocalizedHeroNames } from "../../i18n/useLocalizedHeroNames";

interface Props {
  view: GameView;
  myHeroId: string | null;
  onGiveGold: (heroId: string, amount: number) => void;
}

export function CheatPanel({ view, myHeroId, onGiveGold }: Props) {
  const localizedHeroName = useLocalizedHeroNames();
  const [selectedHeroId, setSelectedHeroId] = useState<string>(myHeroId ?? "");
  const [goldAmount, setGoldAmount] = useState<number>(5);

  const allHeroes = Object.values(view.teams).flatMap(team => team.heroes);

  const handleGiveGold = () => {
    if (selectedHeroId && goldAmount > 0) {
      onGiveGold(selectedHeroId, goldAmount);
    }
  };

  return (
    <div className={styles.cheatPanel}>
      <div className={styles.header}>Cheats</div>
      <div className={styles.field}>
        <label className={styles.label}>Hero</label>
        <select
          className={styles.select}
          value={selectedHeroId}
          onChange={(e) => setSelectedHeroId(e.target.value)}
        >
          {allHeroes.map((hero) => (
            <option key={hero.id} value={hero.id}>
              {localizedHeroName(hero.id, hero.name)} ({hero.team})
            </option>
          ))}
        </select>
      </div>
      <div className={styles.field}>
        <label className={styles.label}>Gold Amount</label>
        <input
          type="number"
          className={styles.input}
          min="1"
          value={goldAmount}
          onChange={(e) => setGoldAmount(Number(e.target.value))}
        />
      </div>
      <button
        className={styles.button}
        onClick={handleGiveGold}
        disabled={!selectedHeroId || goldAmount < 1}
      >
        Give Gold
      </button>
    </div>
  );
}
