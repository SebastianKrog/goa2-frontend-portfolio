import { useEffect, useState } from "react";
import {
  leaveTeam,
  listDraftModes,
  listMaps,
  randomizeTeams,
  setCaptain,
  setTeam,
  startDraft,
  updateDraftSettings,
} from "../../api/draft";
import type {
  DraftModeInfo,
  DraftPlayer,
  DraftView,
  TeamColor,
  UpdateDraftSettingsRequest,
} from "../../types/draft";
import { CHEATS_AVAILABLE } from "../../config/features";
import { formatHeroName } from "../../utils/heroDisplay";
import {
  TimeControlSettings,
} from "../ui/TimeControlSettings";
import { isValidTimeControl } from "../../utils/timeControl";
import styles from "./Draft.module.css";

interface LobbyPhaseProps {
  view: DraftView;
  draftId: string;
  token: string;
  spectatorToken?: string | null;
  onUpdate: (view: DraftView) => void;
  onError: (msg: string) => void;
}

// Total assigned-player counts the engine supports as a match bracket.
const VALID_TOTALS = new Set([2, 4, 5, 6]);

export function LobbyPhase({
  view,
  draftId,
  token,
  spectatorToken,
  onUpdate,
  onError,
}: LobbyPhaseProps) {
  const { draft, you } = view;
  const isHost = !!you?.is_host;
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [modes, setModes] = useState<DraftModeInfo[]>([]);
  const [maps, setMaps] = useState<string[]>([]);
  const [timeControlDraft, setTimeControlDraft] = useState(draft.time_control);

  // The host needs the option lists to populate the settings controls.
  useEffect(() => {
    if (!isHost) return;
    listDraftModes()
      .then(setModes)
      .catch(() => setModes([{ name: draft.draft_mode, description: "" }]));
    listMaps()
      .then(setMaps)
      .catch(() => setMaps([draft.map_name]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost]);

  const run = async (p: Promise<DraftView>) => {
    setBusy(true);
    try {
      onUpdate(await p);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = (settings: UpdateDraftSettingsRequest) =>
    run(updateDraftSettings(draftId, token, settings));

  const copy = (text: string, id: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(id);
        setTimeout(() => setCopied(null), 2000);
      })
      .catch(() => onError("Clipboard access is unavailable. Copy the link from the address bar."));
  };

  const origin = window.location.origin;
  const joinUrl = `${origin}/draft/${draftId}`;
  const spectatorUrl = spectatorToken ? `${origin}/draft/${draftId}?token=${spectatorToken}` : null;

  const playersByTeam = (team: TeamColor) => draft.players.filter((p) => p.team === team);
  // Unassigned players are lobby spectators — they don't count toward the match.
  const spectators = draft.players.filter((p) => p.team === null);
  const redCount = playersByTeam("RED").length;
  const blueCount = playersByTeam("BLUE").length;
  const assignedCount = redCount + blueCount;
  const balanced = Math.abs(redCount - blueCount) <= 1;

  const teamHasCaptain = (team: TeamColor) => playersByTeam(team).some((p) => p.is_captain);
  const readyToStart =
    redCount >= 1 &&
    blueCount >= 1 &&
    teamHasCaptain("RED") &&
    teamHasCaptain("BLUE") &&
    balanced &&
    VALID_TOTALS.has(assignedCount);
  const readiness = [
    { label: "A player on each team", ready: redCount >= 1 && blueCount >= 1 },
    { label: "Balanced teams", ready: balanced },
    { label: "Red captain", ready: teamHasCaptain("RED") },
    { label: "Blue captain", ready: teamHasCaptain("BLUE") },
    { label: "Valid player count", ready: VALID_TOTALS.has(assignedCount) },
  ];

  const renderPlayer = (p: DraftPlayer) => (
    <div key={p.id} className={styles.playerChip}>
      <span className={styles.playerName}>
        {p.is_captain && <span className={styles.captainStar} title="Captain">★</span>}
        {p.display_name}
        {p.is_host && <span className={styles.hostTag}>host</span>}
        {p.id === you?.id && <span className={styles.youTag}>you</span>}
      </span>
      {isHost && p.team && !p.is_captain && (
        <button
          className={styles.miniBtn}
          disabled={busy}
          onClick={() => run(setCaptain(draftId, token, p.id))}
        >
          Choose captain
        </button>
      )}
    </div>
  );

  const renderTeam = (team: TeamColor) => {
    const members = playersByTeam(team);
    // Everyone in the lobby is already a player; joining a side just (re)assigns them.
    const canJoin = !!you && you.team !== team;
    return (
      <div className={`${styles.teamColumn} ${team === "RED" ? styles.teamRed : styles.teamBlue}`}>
        <div className={styles.teamColHeader}>
          <span className={styles.teamColTitle}>{team === "RED" ? "Red" : "Blue"} Team</span>
          <span className={styles.teamColCount}>{members.length}</span>
        </div>
        <div className={styles.playerList}>
          {members.map(renderPlayer)}
          {members.length === 0 && <div className={styles.emptyHint}>No players yet</div>}
        </div>
        {canJoin && (
          <button
            className={styles.joinTeamBtn}
            disabled={busy}
            onClick={() => run(setTeam(draftId, token, team))}
          >
            Join {team === "RED" ? "Red" : "Blue"}
          </button>
        )}
        {you?.team === team && (
          <button
            className={styles.miniBtn}
            disabled={busy}
            onClick={() => run(leaveTeam(draftId, token))}
            title="Leave this team and watch as a spectator"
          >
            Leave team
          </button>
        )}
      </div>
    );
  };

  const modeLabel = (name: string) => modes.find((m) => m.name === name)?.name ?? name;

  const renderSettings = () => (
    <details className={`${styles.settingsBox} ${isHost ? styles.settingsBoxHost : ""}`}>
      <summary className={styles.settingsTitle}>
        <span className={styles.settingsHeading}>
          <span className={styles.settingsIcon} aria-hidden="true">⚙</span>
          <span>
            <span className={styles.settingsName}>Game settings</span>
            {isHost && <span className={styles.settingsHint}>Host controls — map, rules, and draft</span>}
          </span>
        </span>
        <span className={styles.settingsSummary}>
          <span>{isHost ? "Edit game settings" : `${formatHeroName(draft.map_name)} · ${draft.game_type === "LONG" ? "Long" : "Quick"} · ${draft.time_control ? "Timed" : "Untimed"}`}</span>
          <span className={styles.settingsChevron} aria-hidden="true">⌄</span>
        </span>
      </summary>

      <div className={styles.settingsRow}>
        <span className={styles.settingsLabel}>Map</span>
        {isHost ? (
          <select
            className={styles.settingsSelect}
            aria-label="Map"
            value={draft.map_name}
            disabled={busy}
            onChange={(e) => saveSettings({ map_name: e.target.value })}
          >
            {(maps.length ? maps : [draft.map_name]).map((m) => (
              <option key={m} value={m}>
                {formatHeroName(m)}
              </option>
            ))}
          </select>
        ) : (
          <span className={styles.settingsValue}>{formatHeroName(draft.map_name)}</span>
        )}
      </div>

      <div className={styles.settingsRow}>
        <span className={styles.settingsLabel}>Game type</span>
        {isHost ? (
          <div className={styles.seg} aria-label="Game length">
            {(["LONG", "QUICK"] as const).map((gt) => (
              <button
                key={gt}
                type="button"
                disabled={busy}
                className={`${styles.segBtn} ${draft.game_type === gt ? styles.segActive : ""}`}
                aria-pressed={draft.game_type === gt}
                onClick={() => draft.game_type !== gt && saveSettings({ game_type: gt })}
              >
                {gt === "LONG" ? "Long" : "Quick"}
              </button>
            ))}
          </div>
        ) : (
          <span className={styles.settingsValue}>
            {draft.game_type === "LONG" ? "Long" : "Quick"}
          </span>
        )}
      </div>

      <div className={styles.settingsRow}>
        <span className={styles.settingsLabel}>Draft mode</span>
        {isHost ? (
          <select
            className={styles.settingsSelect}
            aria-label="Draft mode"
            value={draft.draft_mode}
            disabled={busy}
            onChange={(e) => saveSettings({ draft_mode: e.target.value })}
          >
            {(modes.length ? modes : [{ name: draft.draft_mode, description: "" }]).map((m) => (
              <option key={m.name} value={m.name}>
                {m.name}
              </option>
            ))}
          </select>
        ) : (
          <span className={styles.settingsValue}>{modeLabel(draft.draft_mode)}</span>
        )}
      </div>

      {CHEATS_AVAILABLE && (
        <div className={styles.settingsRow}>
          <span className={styles.settingsLabel}>Cheats</span>
          {isHost ? (
            <label className={styles.cheatToggle}>
              <input
                type="checkbox"
                checked={draft.cheats}
                disabled={busy}
                onChange={(e) => saveSettings({ cheats_enabled: e.target.checked })}
              />
              <span>{draft.cheats ? "Enabled" : "Disabled"}</span>
            </label>
          ) : (
            <span className={styles.settingsValue}>{draft.cheats ? "Enabled" : "Disabled"}</span>
          )}
        </div>
      )}

      <div className={styles.settingsRow}>
        <span className={styles.settingsLabel}>Max complexity</span>
        {isHost ? (
          <div className={styles.seg} aria-label="Maximum hero complexity">
            {([1, 2, 3, 4] as const).map((n) => (
              <button
                key={n}
                type="button"
                disabled={busy}
                className={`${styles.segBtn} ${draft.max_hero_stars === n ? styles.segActive : ""}`}
                aria-pressed={draft.max_hero_stars === n}
                aria-label={`${n} star maximum complexity`}
                title={`Allow heroes up to ${n} star${n === 1 ? "" : "s"}`}
                onClick={() => draft.max_hero_stars !== n && saveSettings({ max_hero_stars: n })}
              >
                {"★".repeat(n)}
              </button>
            ))}
          </div>
        ) : (
          <span className={styles.settingsValue}>{"★".repeat(draft.max_hero_stars)}</span>
        )}
      </div>
      <div className={styles.timeControlRow}>
        <TimeControlSettings
          value={isHost ? timeControlDraft : draft.time_control}
          onChange={isHost ? setTimeControlDraft : undefined}
          onCommit={isHost ? (next) => {
            if (isValidTimeControl(next)) saveSettings({ time_control: next });
          } : undefined}
          disabled={busy}
          readOnly={!isHost}
        />
      </div>
      {modes.find((mode) => mode.name === draft.draft_mode)?.description && (
        <p className={styles.modeDescription}>{modes.find((mode) => mode.name === draft.draft_mode)?.description}</p>
      )}
    </details>
  );

  return (
    <div className={styles.lobby}>
      <div className={styles.shareBox}>
        <div className={styles.shareTitle}>Invite your group</div>
        <div className={styles.shareRow}>
          <span className={styles.shareLabel}>Players</span>
          <code className={styles.shareUrl}>{joinUrl}</code>
          <button className={styles.miniBtn} onClick={() => copy(joinUrl, "join")}>
            {copied === "join" ? "Copied!" : "Copy link"}
          </button>
        </div>
        {spectatorUrl && (
          <div className={styles.shareRow}>
            <span className={styles.shareLabel}>Spectators</span>
            <code className={styles.shareUrl}>{spectatorUrl}</code>
            <button className={styles.miniBtn} onClick={() => copy(spectatorUrl, "spec")}>
              {copied === "spec" ? "Copied!" : "Copy link"}
            </button>
          </div>
        )}
        {copied && <span className={styles.srOnly} role="status">Link copied</span>}
      </div>

      {renderSettings()}

      <div className={styles.teamsRow}>
        {renderTeam("RED")}
        {renderTeam("BLUE")}
      </div>

      {spectators.length > 0 && (
        <div className={styles.unassigned}>
          <span className={styles.unassignedLabel}>Spectators (not playing)</span>
          <div className={styles.unassignedList}>{spectators.map(renderPlayer)}</div>
        </div>
      )}

      {isHost && (
        <div className={styles.startArea}>
          <div className={styles.readinessList} aria-label="Draft readiness">
            {readiness.map((item) => (
              <span key={item.label} className={item.ready ? styles.checkReady : ""}>
                <b aria-hidden="true">{item.ready ? "✓" : "○"}</b>{item.label}
              </span>
            ))}
          </div>
          <div className={styles.hostControls}>
            <button
              className={styles.secondaryBtn}
              disabled={busy}
              onClick={() => run(randomizeTeams(draftId, token))}
            >
              Randomize teams
            </button>
            <button
              className={styles.primaryBtn}
              disabled={busy || !readyToStart}
              onClick={() => run(startDraft(draftId, token))}
            >
              {busy ? "Working…" : "Start draft"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
