import { useEffect, useMemo, useState } from "react";
import type { InputRequest, UpgradeOption, GameView, CardView, Hex } from "../../types/game";
import { CARD_COLORS } from "../../utils/colors";
import { formatEffectText } from "../../utils/effectText";
import { ITEM_CONFIGS } from "../../utils/itemIcons";
import { classifyDefenseOption, defenseStatLabel } from "../../utils/defense";
import { upgradeOfferKey } from "../../utils/upgradeOffer";
import { Tooltip } from "./Tooltip";
import { CardCanvas } from "../board3d/hud/CardCanvas";
import { useAltHeld } from "../../hooks/useAltHeld";
import styles from "./OptionPicker.module.css";
import { useLocalizedHeroNames } from "../../i18n/useLocalizedHeroNames";

interface Props {
  inputRequest: InputRequest;
  myHeroId: string;
  view?: GameView;
  /**
   * Other players this decision is still waiting on. Sourced from the view, not
   * from `inputRequest.players`, which the server trims to the viewer's own
   * entry.
   */
  waitingForNames: string[];
  onSelect: (value: string | number | null | { hero_id: string; card_id: string }) => void;
  onRollback?: () => void;
  onPreviewHexes?: (hexes: { path: Hex[]; mine_hexes: Hex[] } | null) => void;
  /** Render the UPGRADE_PHASE panel with the 3D glass aesthetic. */
  glass?: boolean;
  onBoardViewChange?: (active: boolean) => void;
}

export function OptionPicker({ inputRequest, myHeroId, view, waitingForNames, onSelect, onRollback, onPreviewHexes, glass, onBoardViewChange }: Props) {
  const localizedHeroName = useLocalizedHeroNames();
  const [peeking, setPeeking] = useState(false);
  // An upgrade is chosen in two steps: pick a card, then confirm it. Picking is
  // free; only the confirm submits, so a stray tap cannot spend an upgrade.
  const [pendingUpgradeId, setPendingUpgradeId] = useState<string | null>(null);
  const type = inputRequest.type;
  const heroSlug = myHeroId.toLowerCase().replace(/^hero_/, "");
  const altHeld = useAltHeld();

  const cardLookup = useMemo(() => {
    if (!view || !myHeroId) return new Map<string, CardView>();
    for (const team of Object.values(view.teams)) {
      const hero = team.heroes.find(h => h.id === myHeroId);
      if (hero) {
        const lookup = new Map<string, CardView>();
        for (const card of hero.hand) {
          lookup.set(card.id, card);
        }
        for (const card of hero.discard_pile) {
          lookup.set(card.id, card);
        }
        if (Array.isArray(hero.deck)) {
          for (const card of hero.deck) {
            lookup.set(card.id, card);
          }
        }
        for (const card of hero.played_cards) {
          if (card) lookup.set(card.id, card);
        }
        if (hero.current_turn_card) {
          lookup.set(hero.current_turn_card.id, hero.current_turn_card);
        }
        return lookup;
      }
    }
    return new Map<string, CardView>();
  }, [view, myHeroId]);

  const isUpgradePhase = type === "UPGRADE_PHASE";
  const boardView = peeking || (isUpgradePhase && altHeld);
  const players = inputRequest.players as Record<string, { remaining: number; options: UpgradeOption[] }> | undefined;
  const myUpgradeData = players?.[myHeroId];

  /* A hero with two upgrades gets a second prompt without this component
     unmounting, so a pick has to be dropped once the offer it belongs to is
     gone. Adjusted during render rather than in an effect, per the repo's
     convention. See upgradeOfferKey for why the request id is not the key. */
  const offerKey = upgradeOfferKey(myUpgradeData);
  const [lastOfferKey, setLastOfferKey] = useState(offerKey);
  if (lastOfferKey !== offerKey) {
    setLastOfferKey(offerKey);
    setPendingUpgradeId(null);
  }

  /* The board is held open by a toggle, so a prompt arriving while it is open
     would sit behind it with only the return button in sight. UPGRADE_PHASE
     keys on its offer instead: see upgradeOfferKey. */
  const promptKey = isUpgradePhase ? offerKey : inputRequest.request_id ?? "";
  const [lastPromptKey, setLastPromptKey] = useState(promptKey);
  if (lastPromptKey !== promptKey) {
    setLastPromptKey(promptKey);
    setPeeking(false);
  }

  useEffect(() => {
    onBoardViewChange?.(boardView);
    return () => onBoardViewChange?.(false);
  }, [boardView, onBoardViewChange]);

  let displayOptions: { id: string; text: string; defense_value?: number; base_defense?: number; color?: string | null; metadata?: { path?: Hex[]; mine_hexes?: Hex[] } }[] = [];

  if (!isUpgradePhase && type === "SELECT_CARD_OR_PASS") {
    const opts = inputRequest.options as Array<{ id: string; text: string; defense_value?: number; base_defense?: number }> | undefined;
    displayOptions = opts ?? [];
  } else if (type === "CHOOSE_ACTION" || type === "SELECT_OPTION") {
    const opts = inputRequest.options ?? [];
    displayOptions = opts
      .map((opt) => {
        if (typeof opt === "string") return { id: opt, text: opt, metadata: undefined };
        const obj = opt as { id: string; text: string; metadata?: { path?: Hex[]; mine_hexes?: Hex[] } };
        return { id: obj.id, text: obj.text, metadata: obj.metadata };
      })
      .filter((opt) => !(onRollback && opt.id === "ROLLBACK"));
  } else if (type === "CONFIRM_PASSIVE" || type === "CHOOSE_RESPAWN") {
    const opts = (inputRequest.options as string[]) ?? ["YES", "NO"];
    displayOptions = opts.map((o) => ({ id: o, text: o }));
  } else if (type === "SELECT_CARD") {
    const opts = (inputRequest.valid_options as string[]) ?? [];
    displayOptions = opts.map((cardId) => {
      const card = cardLookup.get(cardId);
      return {
        id: cardId,
        text: card?.name || cardId,
        color: card?.color,
      };
    });
  } else if (type === "CHOOSE_ACTOR") {
    const ids = inputRequest.player_ids ?? [];
    displayOptions = ids.map((id) => ({ id, text: id }));
  } else if (type === "SELECT_NUMBER") {
    const opts = inputRequest.options as Array<{ id: string; text: string }> | undefined;
    if (opts && opts.length > 0) {
      displayOptions = opts.map((opt) => ({ id: opt.id, text: opt.text }));
    } else {
      const nums = inputRequest.valid_options ?? [];
      displayOptions = nums.map((n) => ({ id: String(n), text: String(n) }));
    }
  }

  const handleOptionClick = (opt: { id: string; text: string }) => {
    onSelect(opt.id);
  };

  const confirmUpgrade = () => {
    if (!pendingUpgradeId) return;
    setPendingUpgradeId(null);
    onSelect({ hero_id: myHeroId, card_id: pendingUpgradeId });
  };

  /* A toggle, not a hold: mousedown/mouseup never reached a phone, which left the
     panel covering the board with no way to get out of it. */
  const peekButton = (
    <button
      type="button"
      className={styles.peekBtn}
      onClick={() => setPeeking((active) => !active)}
      aria-pressed={peeking}
      title={isUpgradePhase ? "View board (or hold Alt)" : "View board"}
    >
      Board
    </button>
  );

  if (boardView) {
    return (
      <div className={`${styles.peekOverlay} ${styles.peekBoardMode}`}>
        {peeking && (
          <button type="button" className={styles.returnBtn} onClick={() => setPeeking(false)}>
            {isUpgradePhase ? "Upgrades" : "Options"}
          </button>
        )}
      </div>
    );
  }

  if (isUpgradePhase && !myUpgradeData) {
    return (
      <div className={styles.overlayUpgrade}>
        <div className={`${styles.pickerUpgrade} ${glass ? styles.pickerUpgradeGlass : ""}`}>
          <div className={styles.titleRow}>
            <div className={styles.title}>{inputRequest.prompt}</div>
            {peekButton}
          </div>
          <div className={styles.waiting}>
            Waiting for other players...
            {waitingForNames.length > 0 && (
              <div className={styles.waitingNames}>{waitingForNames.join(", ")}</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const formatActionName = (action: string) => {
    const names: Record<string, string> = {
      MOVEMENT: "Movement",
      ATTACK: "Attack",
      DEFENSE: "Defense",
      SKILL: "Skill",
      DEFENSE_SKILL: "Defense Skill",
      HOLD: "Hold",
      CLEAR: "Clear",
      FAST_TRAVEL: "Fast Travel",
    };
    return names[action] || action;
  };

  const getActionClass = (action: string) => {
    const actionMap: Record<string, string> = {
      MOVEMENT: "actionMovement",
      ATTACK: "actionAttack",
      DEFENSE: "actionDefense",
      SKILL: "actionSkill",
      DEFENSE_SKILL: "actionDefenseSkill",
    };
    return actionMap[action] || "";
  };

  if (isUpgradePhase && myUpgradeData) {
    const pendingCard = pendingUpgradeId
      ? myUpgradeData.options
          .flatMap((option) => option.card_details)
          .find((card) => card.id === pendingUpgradeId)
      : undefined;

    return (
      <div className={styles.overlayUpgrade}>
        <div className={`${styles.pickerUpgrade} ${glass ? styles.pickerUpgradeGlass : ""}`}>
          <div className={styles.titleRow}>
            <div className={styles.title}>{inputRequest.prompt}</div>
            {peekButton}
          </div>
          <div className={styles.remaining}>Upgrades remaining: {myUpgradeData.remaining}</div>
          <div className={styles.upgradeGroups}>
            {myUpgradeData.options.map((option, idx) => (
              <div key={idx} className={styles.upgradeGroup}>
                <div className={styles.upgradeGroupHeader}>
                  <span
                    className={styles.colorPip}
                    style={{ background: CARD_COLORS[option.color] || "#888" }}
                  />
                  <span className={styles.groupInfo}>
                    {option.color} Tier {option.tier}
                  </span>
                </div>
                <div className={styles.cardPair}>
                  {option.card_details.map((card, cardIdx) => {
                    const otherCard = option.card_details[cardIdx === 0 ? 1 : 0];
                    const gainedItem = otherCard?.item ? ITEM_CONFIGS[otherCard.item] : null;

                    const isPending = pendingUpgradeId === card.id;
                    const cardButton = (
                      <button
                        key={card.id}
                        type="button"
                        className={`${styles.upgradeCard} ${isPending ? styles.upgradeCardPending : ""}`}
                        aria-pressed={isPending}
                        onClick={() => setPendingUpgradeId(isPending ? null : card.id)}
                      >
                        <div className={styles.cardName}>{card.name}</div>
                        {card.primary_action && (
                          <div className={styles.cardAction}>
                            <span className={`${styles.actionTag} ${styles[getActionClass(card.primary_action)]}`}>
                              {formatActionName(card.primary_action)}
                              {card.primary_action_value != null && !["HOLD", "CLEAR", "FAST_TRAVEL"].includes(card.primary_action) ? ` ${card.primary_action_value}` : ""}
                            </span>
                          </div>
                        )}
                        {card.secondary_actions && Object.keys(card.secondary_actions).length > 0 && (
                          <div className={styles.cardSecondary}>
                            {Object.entries(card.secondary_actions).map(([action, value]) => (
                              <span key={action} className={styles.secondaryTag}>
                                {formatActionName(action)}{!["HOLD", "CLEAR", "FAST_TRAVEL"].includes(action) ? ` ${value}` : ""}
                              </span>
                            ))}
                          </div>
                        )}
                        {card.effect_text && <div className={styles.cardEffect}>{formatEffectText(card.effect_text)}</div>}
                        {gainedItem && (
                          <div className={styles.cardGainedItem}>
                            <span className={styles.gainedLabel}>Choosing this gains:</span>
                            <span className={styles.gainedValue}>
                              <img src={gainedItem.icon} alt={gainedItem.label} className={styles.gainedIcon} />
                              {gainedItem.label}
                            </span>
                          </div>
                        )}
                      </button>
                    );

                    const cardImageView = {
                      ...card,
                      image_id: card.image_id,
                      effect_id: null,
                      state: "DECK",
                      is_facedown: false,
                      is_active: false,
                    } as unknown as CardView;

                    return (
                      <Tooltip
                        key={card.id}
                        position="auto"
                        bare
                        delay={120}
                        content={<CardCanvas card={cardImageView} heroSlug={heroSlug} width={260} />}
                      >
                        {cardButton}
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {waitingForNames.length > 0 && (
            <div className={styles.waitingFooter}>
              Also waiting for: {waitingForNames.join(", ")}
            </div>
          )}
          {/* Sticky so it stays reachable when the list scrolls on a phone. */}
          <div className={styles.upgradeConfirmBar}>
            <span className={styles.upgradeConfirmLabel}>
              {pendingCard ? `Take ${pendingCard.name}?` : "Pick an upgrade to continue."}
            </span>
            {pendingCard && (
              <button type="button" className={styles.upgradeCancelBtn} onClick={() => setPendingUpgradeId(null)}>
                Cancel
              </button>
            )}
            <button
              type="button"
              className={styles.upgradeConfirmBtn}
              disabled={!pendingCard}
              onClick={confirmUpgrade}
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (type === "SELECT_CARD_OR_PASS") {
    const attackerName = view?.current_actor_id
      ? (() => {
          for (const team of Object.values(view.teams)) {
            const hero = team.heroes.find(h => h.id === view.current_actor_id);
            if (hero) return localizedHeroName(hero.id, hero.name);
          }
          return null;
        })()
      : null;

    const hasPrimaryDefense = displayOptions.some(
      (opt) => classifyDefenseOption(opt, cardLookup.get(opt.id), inputRequest.defense_needed).state === "PRIMARY"
    );

    const canAnyBlock = displayOptions.some(
      (opt) => classifyDefenseOption(opt, cardLookup.get(opt.id), inputRequest.defense_needed).state === "BLOCKS"
    );

    return (
      <div className={styles.overlay}>
        <div className={styles.picker}>
          <div className={styles.titleRow}>
            <div className={styles.title}>{inputRequest.prompt}</div>
            {peekButton}
          </div>
          {inputRequest.attack_value !== undefined && inputRequest.attack_value !== null && (
            <div className={styles.combatContext}>
              {attackerName && (
                <div className={styles.combatStat}>
                  <span className={styles.combatLabel}>Attacker:</span>
                  <span className={styles.combatValue}>{attackerName}</span>
                </div>
              )}
              <div className={styles.combatStat}>
                <span className={styles.combatLabel}>Attack:</span>
                <span className={styles.combatValue}>{inputRequest.attack_value}</span>
              </div>
              {inputRequest.minion_modifier !== undefined && inputRequest.minion_modifier !== 0 && (
                <div className={styles.combatStat}>
                  <span className={styles.combatLabel}>Minion bonus:</span>
                  <span className={`${styles.combatValue} ${inputRequest.minion_modifier > 0 ? styles.positive : styles.negative}`}>
                    {inputRequest.minion_modifier > 0 ? '+' : ''}{inputRequest.minion_modifier}
                  </span>
                </div>
              )}
              {inputRequest.defense_needed !== undefined && inputRequest.defense_needed !== null && (
                <div className={styles.combatStat}>
                  <span className={styles.combatLabel}>Defense needed:</span>
                  <span className={styles.combatValue}>{inputRequest.defense_needed}</span>
                </div>
              )}
            </div>
          )}
          {!canAnyBlock && !hasPrimaryDefense && inputRequest.defense_needed !== undefined && inputRequest.defense_needed !== null && (
            <div className={styles.noBlockWarning}>No card can fully defend — consider passing</div>
          )}
          <div className={styles.optionsList}>
            {displayOptions.map((opt) => {
              const defenseValue = opt.defense_value;
              const isPass = opt.id === "PASS";
              const card = cardLookup.get(opt.id);
              const info = classifyDefenseOption(opt, card, inputRequest.defense_needed);
              const isPrimaryDefense = info.state === "PRIMARY";
              const canBlock = info.state === "BLOCKS";
              const cardColor = card?.color ? CARD_COLORS[card.color] : undefined;

              return (
                <button
                  key={opt.id}
                  type="button"
                  className={`${styles.option} ${isPass ? styles.passOption : ""} ${isPrimaryDefense ? styles.primaryDefense : canBlock ? styles.canBlock : styles.cannotBlock}`}
                  onClick={() => handleOptionClick(opt)}
                >
                  <div className={styles.optionMain}>
                    <span className={styles.optionText} style={cardColor ? { color: cardColor } : undefined}>{opt.text}</span>
                    {!isPass && isPrimaryDefense && (
                      <span className={`${styles.defenseBadge} ${styles.badgePrimary}`}>
                        Primary Defense
                      </span>
                    )}
                    {!isPass && !isPrimaryDefense && defenseValue !== undefined && (
                      <span className={`${styles.defenseBadge} ${canBlock ? styles.badgeGood : styles.badgeInsufficient}`}>
                        {defenseStatLabel(opt.text)}: {defenseValue}
                      </span>
                    )}
                  </div>
                  {!isPrimaryDefense && defenseValue !== undefined && opt.base_defense !== undefined && (
                    <div className={styles.optionSubtext}>
                      Base: {opt.base_defense}
                      {defenseValue > opt.base_defense && ` (+${defenseValue - opt.base_defense})`}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.picker}>
        <div className={styles.titleRow}>
          <div className={styles.title}>{inputRequest.prompt}</div>
          {peekButton}
        </div>
        {displayOptions.map((opt) => {
          const cardColor = opt.color ? CARD_COLORS[opt.color] : undefined;
          const handleEnter = () => {
            if (onPreviewHexes && opt.metadata) {
              onPreviewHexes({ path: opt.metadata.path ?? [], mine_hexes: opt.metadata.mine_hexes ?? [] });
            }
          };
          const handleLeave = () => {
            if (onPreviewHexes) onPreviewHexes(null);
          };
          return (
            <button
              key={opt.id}
              type="button"
              className={styles.option}
              onClick={() => handleOptionClick(opt)}
              onMouseEnter={handleEnter}
              onMouseLeave={handleLeave}
            >
              <span style={cardColor ? { color: cardColor } : undefined}>{opt.text}</span>
            </button>
          );
        })}
        {inputRequest.can_skip && (
          <button
            type="button"
            className={`${styles.option} ${styles.skip}`}
            onClick={() => onSelect("SKIP")}
          >
            Skip
          </button>
        )}
        {onRollback && (
          <button
            type="button"
            className={`${styles.option} ${styles.undo}`}
            onClick={onRollback}
          >
            Undo
          </button>
        )}
      </div>
    </div>
  );
}
