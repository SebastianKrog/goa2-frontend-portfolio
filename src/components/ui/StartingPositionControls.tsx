import type { StartingPositionAction, StartingPositionView } from "../../types/game";
import styles from "./StartingPositionControls.module.css";

interface Props {
  position: StartingPositionView;
  inRail?: boolean;
  heroId: string;
  choosing: boolean;
  onChoosing: (value: boolean) => void;
  onAction: (action: StartingPositionAction) => void;
  heroName: (id: string) => string;
}

export function StartingPositionControls({ position, inRail = false, heroId, choosing, onChoosing, onAction, heroName }: Props) {
  const outgoing = position.requests.some((request) => request.from === heroId);
  return <div className={`${styles.panel} ${inRail ? styles.inRail : ""}`} aria-label="Starting position">
    <button type="button" onClick={() => onChoosing(!choosing)}>
      {choosing ? "Done adjusting" : "Change starting position"}
    </button>
    {choosing && <>
      <span>{position.destinations.length ? "Choose a highlighted space or request a swap." : "Request a swap with a teammate."}</span>
      <small>Available while you have no committed card.</small>
      {position.swap_targets.map((id) => <button type="button" key={id}
        onClick={() => onAction({ op: "request_swap", target: id })}>
        Swap with {heroName(id)}
      </button>)}
    </>}
    {outgoing && <div role="status">Waiting for teammate approval. <button type="button"
      onClick={() => onAction({ op: "cancel" })}>Cancel request</button></div>}
    {position.requests.filter((request) => request.to === heroId).map((request) =>
      <div key={request.id} role="status">
        <span>{heroName(request.from)} wants to swap starting positions.</span>
        <button type="button" onClick={() => onAction({ op: "respond_swap", request_id: request.id, accept: true })}>Accept</button>
        <button type="button" onClick={() => onAction({ op: "respond_swap", request_id: request.id, accept: false })}>Decline</button>
      </div>)}
  </div>;
}
