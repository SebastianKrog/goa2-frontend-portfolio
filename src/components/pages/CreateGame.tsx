import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchHeroMetadata, createGame } from "../../api/rest";
import type { GameType, HeroMetadata } from "../../api/rest";
import { listMaps } from "../../api/draft";
import type { CreateGameResponse } from "../../types/game";
import type { TimeControlConfig } from "../../types/game";
import {
  TimeControlSettings,
} from "../ui/TimeControlSettings";
import { isValidTimeControl } from "../../utils/timeControl";
import { CHEATS_AVAILABLE } from "../../config/features";
import { formatHeroName, heroImagePath } from "../../utils/heroDisplay";
import styles from "./CreateGame.module.css";
import { PLAYER_NAME_MAX_LENGTH } from "../../utils/playerName";
import { evaluateSetup } from "../../utils/gameSetup";

const MAX_HEROES_PER_TEAM = 5;
type Team = "red" | "blue";

export function CreateGame() {
  const [heroes, setHeroes] = useState<HeroMetadata[]>([]);
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});
  const [redHeroes, setRedHeroes] = useState<string[]>([]);
  const [blueHeroes, setBlueHeroes] = useState<string[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team>("red");
  const [draggedHero, setDraggedHero] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState(0);
  const [maps, setMaps] = useState<string[]>(["forgotten_island"]);
  const [mapName, setMapName] = useState("forgotten_island");
  const [gameType, setGameType] = useState<GameType>("LONG");
  const [cheatsEnabled, setCheatsEnabled] = useState(false);
  const [timeControl, setTimeControl] = useState<TimeControlConfig | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [loadingHeroes, setLoadingHeroes] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateGameResponse | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Manual Setup - Guards of Atlantis II";
    fetchHeroMetadata({ includePlaytest: import.meta.env.DEV })
      .then(setHeroes)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load heroes"))
      .finally(() => setLoadingHeroes(false));
    listMaps().then((nextMaps) => {
      if (nextMaps.length) setMaps(nextMaps);
    }).catch(() => {});
  }, []);

  const assigned = useMemo(() => new Set([...redHeroes, ...blueHeroes]), [redHeroes, blueHeroes]);
  const availableHeroes = useMemo(() => {
    const query = search.trim().toLowerCase();
    return heroes
      .filter((hero) => !assigned.has(hero.id))
      .filter((hero) => difficulty === 0 || hero.difficulty_stars === difficulty)
      .filter((hero) => !query || formatHeroName(hero.id).toLowerCase().includes(query))
      .sort((a, b) => formatHeroName(a.id).localeCompare(formatHeroName(b.id)));
  }, [heroes, assigned, difficulty, search]);

  const assignHero = useCallback((hero: string, team: Team) => {
    setRedHeroes((currentRed) => {
      const withoutHero = currentRed.filter((id) => id !== hero);
      if (team === "red" && withoutHero.length < MAX_HEROES_PER_TEAM) return [...withoutHero, hero];
      return withoutHero;
    });
    setBlueHeroes((currentBlue) => {
      const withoutHero = currentBlue.filter((id) => id !== hero);
      if (team === "blue" && withoutHero.length < MAX_HEROES_PER_TEAM) return [...withoutHero, hero];
      return withoutHero;
    });
    setDraggedHero(null);
  }, []);

  const removeHero = (hero: string, team: Team) => {
    if (team === "red") setRedHeroes((current) => current.filter((id) => id !== hero));
    else setBlueHeroes((current) => current.filter((id) => id !== hero));
  };

  const totalPlayers = redHeroes.length + blueHeroes.length;
  const { valid: validSetup, hint: setupHint } = evaluateSetup({
    redCount: redHeroes.length,
    blueCount: blueHeroes.length,
    validTimeControl: isValidTimeControl(timeControl),
  });

  // Names for heroes no longer on a team must not reach the request.
  const assignedPlayerNames = useMemo(() => {
    const assignedHeroes = new Set([...redHeroes, ...blueHeroes]);
    return Object.fromEntries(
      Object.entries(playerNames).filter(([hero, name]) => assignedHeroes.has(hero) && name.trim()),
    );
  }, [playerNames, redHeroes, blueHeroes]);

  const handleSubmit = async () => {
    if (!validSetup || loading) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await createGame(
        redHeroes,
        blueHeroes,
        mapName,
        cheatsEnabled,
        gameType,
        timeControl,
        assignedPlayerNames,
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create game");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setError("Clipboard access is unavailable. Open the link and copy it from the address bar.");
    }
  }, []);

  const renderTeam = (team: Team, teamHeroes: string[]) => (
    <section
      className={`${styles.teamPanel} ${styles[team]} ${selectedTeam === team ? styles.teamActive : ""}`}
      onDragOver={(event) => event.preventDefault()}
      onDrop={() => draggedHero && assignHero(draggedHero, team)}
      aria-label={`${formatHeroName(team)} team, ${teamHeroes.length} heroes`}
    >
      <button className={styles.teamHeading} type="button" onClick={() => setSelectedTeam(team)} aria-pressed={selectedTeam === team}>
        <span>{formatHeroName(team)} Team</span>
        <span>{teamHeroes.length} / {MAX_HEROES_PER_TEAM}</span>
      </button>
      <div className={styles.teamRoster}>
        {teamHeroes.map((hero) => (
          <article className={styles.rosterHero} key={hero}>
            <img src={heroImagePath(hero)} alt="" />
            <div className={styles.heroMeta}>
              <span>{formatHeroName(hero)}</span>
              <input
                className={styles.playerNameInput}
                type="text"
                name={`playerName-${hero}`}
                autoComplete="off"
                maxLength={PLAYER_NAME_MAX_LENGTH}
                placeholder="Player name"
                value={playerNames[hero] ?? ""}
                onChange={(event) =>
                  setPlayerNames((current) => ({ ...current, [hero]: event.target.value }))
                }
                aria-label={`Player name for ${formatHeroName(hero)}`}
              />
            </div>
            <button type="button" onClick={() => removeHero(hero, team)} aria-label={`Remove ${formatHeroName(hero)} from ${team} team`}>×</button>
          </article>
        ))}
        {!teamHeroes.length && <div className={styles.emptyTeam}>Select this team, then choose heroes</div>}
      </div>
    </section>
  );

  if (result) {
    const baseUrl = window.location.origin;
    const matchHero = (heroId: string, team: Team) => {
      const pool = team === "red" ? redHeroes : blueHeroes;
      const bare = heroId.replace(/^hero_/, "").toLowerCase();
      return pool.some((id) => id.toLowerCase() === bare);
    };
    const byTeam = (team: Team) => result.player_tokens.filter((player) => matchHero(player.hero_id, team));
    const displayId = (heroId: string) => heroId.replace(/^hero_/, "");
    const allLinks = result.player_tokens
      .map((player) => `${formatHeroName(displayId(player.hero_id))}: ${baseUrl}/game/${result.game_id}?token=${player.token}`)
      .concat(`Spectator: ${baseUrl}/game/${result.game_id}?token=${result.spectator_token}`)
      .join("\n");

    return (
      <div className={styles.page}>
        <main className={`${styles.container} ${styles.resultContainer}`}>
          <Link to="/" className={styles.back}>← Home</Link>
          <div className={styles.resultHeader}>
            <div className={styles.kicker}>Game created</div>
            <h1>Your table is ready</h1>
            <p>Send each player their hero link, or copy the whole roster for your group chat.</p>
          </div>
          <div className={styles.resultTeams}>
            {(["red", "blue"] as Team[]).map((team) => (
              <section key={team} className={`${styles.resultTeam} ${styles[team]}`}>
                <h2>{formatHeroName(team)} Team</h2>
                {byTeam(team).map((player) => {
                  const heroId = displayId(player.hero_id);
                  const url = `${baseUrl}/game/${result.game_id}?token=${player.token}`;
                  return (
                    <div className={styles.playerLink} key={heroId}>
                      <img src={heroImagePath(heroId)} alt="" />
                      <span>{formatHeroName(heroId)}</span>
                      <button type="button" onClick={() => copyToClipboard(url, heroId)}>
                        {copiedId === heroId ? "Copied" : "Copy link"}
                      </button>
                      <a href={url}>Open</a>
                    </div>
                  );
                })}
              </section>
            ))}
          </div>
          <div className={styles.resultActions}>
            <button className={styles.primaryButton} type="button" onClick={() => copyToClipboard(allLinks, "all")}>
              {copiedId === "all" ? "Roster copied" : "Copy all links"}
            </button>
            <button className={styles.secondaryButton} type="button" onClick={() => copyToClipboard(`${baseUrl}/game/${result.game_id}?token=${result.spectator_token}`, "spectator")}>
              {copiedId === "spectator" ? "Spectator link copied" : "Copy spectator link"}
            </button>
            <button className={styles.textButton} type="button" onClick={() => { setResult(null); setRedHeroes([]); setBlueHeroes([]); }}>
              Set up another game
            </button>
          </div>
          {error && <div className={styles.error} role="alert">{error}</div>}
        </main>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <main className={styles.container}>
        <header className={styles.header}>
          <Link to="/" className={styles.back}>← Home</Link>
          <div>
            <div className={styles.kicker}>Manual setup</div>
            <h1>Build the teams</h1>
            <p>Select a team, then tap its heroes. Dragging works too.</p>
          </div>
          <span className={styles.headerSpacer} />
        </header>

        <div className={styles.teamTabs} aria-label="Team to add heroes to">
          {(["red", "blue"] as Team[]).map((team) => (
            <button key={team} type="button" className={`${styles.teamTab} ${styles[team]} ${selectedTeam === team ? styles.teamTabActive : ""}`} onClick={() => setSelectedTeam(team)} aria-pressed={selectedTeam === team}>
              Add to {formatHeroName(team)} <span>{team === "red" ? redHeroes.length : blueHeroes.length}</span>
            </button>
          ))}
        </div>

        <div className={styles.gameSetup}>
          {renderTeam("red", redHeroes)}
          <section className={styles.heroPool} aria-label="Available heroes">
            <div className={styles.poolTools}>
              <label className={styles.searchField}>
                <span className={styles.srOnly}>Search heroes</span>
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search heroes…" />
              </label>
              <div className={styles.difficultyFilter} aria-label="Filter by complexity">
                {[0, 1, 2, 3, 4].map((stars) => (
                  <button key={stars} type="button" onClick={() => setDifficulty(stars)} aria-pressed={difficulty === stars} className={difficulty === stars ? styles.filterActive : ""}>
                    {stars === 0 ? "All" : "★".repeat(stars)}
                  </button>
                ))}
              </div>
            </div>

            {loadingHeroes ? <div className={styles.poolMessage} role="status">Gathering heroes…</div> : (
              <div className={styles.heroGrid}>
                {availableHeroes.map((hero) => {
                  const teamIsFull = selectedTeam === "red" ? redHeroes.length >= MAX_HEROES_PER_TEAM : blueHeroes.length >= MAX_HEROES_PER_TEAM;
                  return (
                    <button
                      type="button"
                      key={hero.id}
                      className={styles.heroCard}
                      draggable
                      disabled={teamIsFull}
                      onDragStart={() => setDraggedHero(hero.id)}
                      onDragEnd={() => setDraggedHero(null)}
                      onClick={() => assignHero(hero.id, selectedTeam)}
                      aria-label={`Add ${formatHeroName(hero.id)} to ${selectedTeam} team, ${hero.difficulty_stars} star complexity`}
                    >
                      <img src={heroImagePath(hero.id)} alt="" draggable={false} loading="lazy" />
                      <span className={styles.heroGradient} />
                      <span className={styles.heroName}>{formatHeroName(hero.id)}</span>
                      <span className={styles.stars} aria-hidden="true">{"★".repeat(hero.difficulty_stars)}</span>
                    </button>
                  );
                })}
                {!availableHeroes.length && <div className={styles.poolMessage}>No heroes match that filter.</div>}
              </div>
            )}
          </section>
          {renderTeam("blue", blueHeroes)}
        </div>

        <footer className={styles.setupFooter}>
          <div className={styles.matchOptions}>
            <label>
              <span>Map</span>
              <select value={mapName} onChange={(event) => setMapName(event.target.value)}>
                {maps.map((map) => <option value={map} key={map}>{formatHeroName(map)}</option>)}
              </select>
            </label>
            <fieldset>
              <legend>Game length</legend>
              <div className={styles.segmented}>
                {(["LONG", "QUICK"] as GameType[]).map((type) => (
                  <button type="button" key={type} onClick={() => setGameType(type)} aria-pressed={gameType === type} className={gameType === type ? styles.segmentActive : ""}>
                    {type === "LONG" ? "Long · full match" : "Quick · shorter match"}
                  </button>
                ))}
              </div>
            </fieldset>
            {CHEATS_AVAILABLE && (
              <details open={advancedOpen} onToggle={(event) => setAdvancedOpen(event.currentTarget.open)} className={styles.advanced}>
                <summary>Advanced</summary>
                <label><input type="checkbox" checked={cheatsEnabled} onChange={(event) => setCheatsEnabled(event.target.checked)} /> Enable cheats</label>
              </details>
            )}
          </div>
          <details className={styles.timerSettings}>
            <summary>
              Match clocks
              <span>{timeControl ? "Timed" : "Untimed"}</span>
            </summary>
            <TimeControlSettings value={timeControl} onChange={setTimeControl} />
          </details>
          <div className={`${styles.readiness} ${validSetup ? styles.ready : ""}`} aria-live="polite">
            <span>{setupHint}</span>
            <button type="button" className={styles.primaryButton} onClick={handleSubmit} disabled={!validSetup || loading}>
              {loading ? "Creating game…" : totalPlayers ? `Start ${totalPlayers}-hero game` : "Start game"}
            </button>
          </div>
          {error && <div className={styles.error} role="alert">{error}</div>}
        </footer>
      </main>
    </div>
  );
}
