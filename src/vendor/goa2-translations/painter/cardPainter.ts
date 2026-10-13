// Vendored from goa2-translations (src/painter/cardPainter.ts). Do not edit — see scripts/sync-translations.mjs.
import { ENGLISH_PAINTER_LABELS, type PainterLabels } from '../types';
import LineBreaker from './vendor/linebreak.js';

export const PAINTER_DISPLAY_FONT = '"Modesto Poster", "Noto Sans SC Variable", sans-serif'
export const PAINTER_BODY_FONT = 'Arial, "Noto Sans SC Variable", sans-serif'

const CJK_SCRIPT = /\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Hangul}/u

export function updateCanvas(
	canvas: HTMLCanvasElement,
	context: CanvasRenderingContext2D,
	customEmoji: Array<[string, HTMLImageElement]>,
	background: HTMLImageElement | undefined,
	color: Color,
	handicap: boolean,
	extra: boolean,
	name: string,
	description: string,
	level: string,
	item: Item,
	initiative: number,
	primaryActionType: Type,
	primaryActionValue: number,
	primaryActionValueSign: ValueSign,
	modifier: Modifier,
	modifierValue: number,
	modifierValueSign: ValueSign,
	secondaryMovementValue: number,
	secondaryDefenseValue: number,
	secondaryAttackValue: number | null,
	initiativeBonus: number = 0,
	attackBonus: number = 0,
	defenseBonus: number = 0,
	areaBonus: number = 0,
	rangeBonus: number = 0,
	movementBonus: number = 0,
	showNumbers: boolean = true,
	attackStat: number = 0,
	defenseStat: number = 0,
	initiativeStat: number = 0,
	movementStat: number = 0,
	labels?: PainterLabels
): void {
	clear(canvas, context);

	// Body text (title, description) inherits the context fillStyle rather than
	// setting its own. Reset it here so a canvas previously used to paint a card
	// back (paintFacedown leaves fillStyle white) doesn't bleed white text.
	context.fillStyle = "black";

	if (background instanceof HTMLImageElement) {
		context.drawImage(background, 0, 0, 1192, 1664);
	}

	if (color == Color.PURPLE) {
		addImage(context, 'title_ultimate', 0, 0);
		addTitle(context, name, 594, 140, 760);
	} else {
		addImage(context, 'title', 0, 0);
		addTitle(context, name, 632, 140, 710);
	}

	const rawDescriptionLines = description.split(/\r\n|\r|\n/);
	const maxDescriptionLines =
		(level == 'ii' || level == 'iii') &&
		(color == Color.RED || color == Color.BLUE || color == Color.GREEN)
			? 7
			: 8;
	const descriptionFit = fitDescriptionLines(
		context,
		rawDescriptionLines,
		960,
		maxDescriptionLines,
		name,
	);
	const descriptionLines = descriptionFit.lines;
	const descriptionHeight = descriptionLines.length;
	const descriptionLayout = getCardDescriptionLayout(
		context,
		descriptionLines,
		descriptionFit.fontSizeAdjustment,
	);
	cardDescriptionIndent = descriptionLayout.indent;
	descriptionFontSizeAdjustment = descriptionFit.fontSizeAdjustment;
	const hasSecondaryAttack = secondaryAttackValue !== null;
	const hasSecondaryMovement = color != Color.SILVER && secondaryMovementValue !== 0;
	const hasSecondaryDefense = primaryActionType != Type.DEFENSE && primaryActionType != Type.DEFENSE_SKILL;
	const secondaryBannerOffset =
		hasSecondaryAttack && hasSecondaryMovement && hasSecondaryDefense && primaryActionType != Type.MOVEMENT
			? 50
			: 0;
	context.font = `49px ${PAINTER_BODY_FONT}`;

	function placeSecondary(inset: number) {
		const adjustedInset = hasSecondaryAttack ? inset - 209 + 20 : inset;
		const attackInset = inset + 20;

		function addSecondaryAttack(atInset: number) {
			addImage(context, 'attack', 35, atInset - 25);
			addSecondaryValue(
				context,
				secondaryAttackValue! + attackBonus,
				143,
				atInset + 121,
				attackBonus,
				showNumbers,
				color,
				level,
				Stat.ATTACK,
				attackStat,
			);
		}

		if (!hasSecondaryMovement) {
			if (primaryActionType != Type.DEFENSE && primaryActionType != Type.DEFENSE_SKILL) {
				addImage(context, 'defense', 70, adjustedInset);
				addSecondaryValue(
					context,
					secondaryDefenseValue + defenseBonus,
					143,
					adjustedInset + 131,
					defenseBonus,
					showNumbers,
					color,
					level,
					Stat.DEFENSE,
					defenseStat,
				);
			}
			if (hasSecondaryAttack) {
				addSecondaryAttack(attackInset);
			}
			return;
		}

		if (primaryActionType == Type.DEFENSE || primaryActionType == Type.DEFENSE_SKILL) {
			addImage(context, 'movement', 64, adjustedInset);
			addSecondaryValue(
				context,
				secondaryMovementValue + movementBonus,
				143,
				adjustedInset + 121,
				movementBonus,
				showNumbers,
				color,
				level,
				Stat.MOVEMENT,
				movementStat,
			);
			if (hasSecondaryAttack) {
				addSecondaryAttack(attackInset);
			}
		} else if (primaryActionType == Type.MOVEMENT) {
			addImage(context, 'defense', 70, adjustedInset);
			addSecondaryValue(
				context,
				secondaryDefenseValue + defenseBonus,
				143,
				adjustedInset + 131,
				defenseBonus,
				showNumbers,
				color,
				level,
				Stat.DEFENSE,
				defenseStat,
			);
			if (hasSecondaryAttack) {
				addSecondaryAttack(attackInset);
			}
		} else {
			addImage(context, 'movement', 64, adjustedInset);
			addImage(context, 'defense', 70, adjustedInset - 209);
			addSecondaryValue(
				context,
				secondaryMovementValue + movementBonus,
				143,
				adjustedInset + 121,
				movementBonus,
				showNumbers,
				color,
				level,
				Stat.MOVEMENT,
				movementStat,
			);
			addSecondaryValue(
				context,
				secondaryDefenseValue + defenseBonus,
				143,
				adjustedInset - 79,
				defenseBonus,
				showNumbers,
				color,
				level,
				Stat.DEFENSE,
				defenseStat,
			);
			if (hasSecondaryAttack) {
				addSecondaryAttack(attackInset);
			}
		}
	}

	function placeSecondaryOnSilver(inset: number) {
		const hasSecondaryAttack = secondaryAttackValue !== null;
		const adjustedInset = hasSecondaryAttack ? inset - 209 + 20 : inset;
		const attackInset = inset + 20;

		if (primaryActionType != Type.DEFENSE && primaryActionType != Type.DEFENSE_SKILL) {
			addImage(context, 'defense', 70, adjustedInset);
			addSecondaryValue(
				context,
				secondaryDefenseValue + defenseBonus,
				143,
				adjustedInset + 131,
				defenseBonus,
				showNumbers,
				color,
				level,
				Stat.DEFENSE,
				defenseStat,
			);
		}
		if (hasSecondaryAttack) {
			addImage(context, 'attack', 35, attackInset - 25);
			addSecondaryValue(
				context,
				secondaryAttackValue! + attackBonus,
				143,
				attackInset + 121,
				attackBonus,
				showNumbers,
				color,
				level,
				Stat.ATTACK,
				attackStat,
			);
		}
	}

	switch (color) {
		case Color.GOLD:
			switch (descriptionHeight) {
				case 1:
				case 2:
				case 3:
				case 4:
				case 5:
				case 6:
					if (secondaryBannerOffset > 0) addImage(context, 'banner_gold_bottom', 50, 278);
					addImage(context, 'banner_gold_bottom', 50, 278 + secondaryBannerOffset);
					addImage(context, 'banner_gold_top', 50, 0);
					placeSecondary(645 + secondaryBannerOffset);
					break;
				case 7:
					if (secondaryBannerOffset > 0) addImage(context, 'banner_gold_bottom', 50, 219);
					addImage(context, 'banner_gold_bottom', 50, 219 + secondaryBannerOffset);
					addImage(context, 'banner_gold_top', 50, 0);
					placeSecondary(586 + secondaryBannerOffset);
					break;
				default:
					if (secondaryBannerOffset > 0) addImage(context, 'banner_gold_bottom', 50, 158);
					addImage(context, 'banner_gold_bottom', 50, 158 + secondaryBannerOffset);
					addImage(context, 'banner_gold_top', 50, 0);
					placeSecondary(525 + secondaryBannerOffset);
					break;
			}
			break;
		case Color.SILVER:
			switch (descriptionHeight) {
				case 1:
				case 2:
				case 3:
				case 4:
				case 5:
				case 6:
					if (secondaryBannerOffset > 0) addImage(context, 'banner_silver_bottom', 50, 318);
					addImage(context, 'banner_silver_bottom', 50, 318 + secondaryBannerOffset);
					addImage(context, 'banner_silver_top', 50, 0);
					placeSecondaryOnSilver(637 + secondaryBannerOffset);
					break;
				case 7:
					if (secondaryBannerOffset > 0) addImage(context, 'banner_silver_bottom', 50, 259);
					addImage(context, 'banner_silver_bottom', 50, 259 + secondaryBannerOffset);
					addImage(context, 'banner_silver_top', 50, 0);
					placeSecondaryOnSilver(578 + secondaryBannerOffset);
					break;
				default:
					if (secondaryBannerOffset > 0) addImage(context, 'banner_silver_bottom', 50, 198);
					addImage(context, 'banner_silver_bottom', 50, 198 + secondaryBannerOffset);
					addImage(context, 'banner_silver_top', 50, 0);
					placeSecondaryOnSilver(517 + secondaryBannerOffset);
					break;
			}
			break;
		case Color.RED:
			if (level == 'ii' || level == 'iii') {
				switch (descriptionHeight) {
					case 1:
					case 2:
					case 3:
					case 4:
						if (secondaryBannerOffset > 0) addImage(context, 'banner_red_bottom', 50, 330);
						addImage(context, 'banner_red_bottom', 50, 330 + secondaryBannerOffset);
						addImage(context, 'banner_red_top', 50, 0);
						placeSecondary(645 + secondaryBannerOffset);
						break;
					case 5:
						if (secondaryBannerOffset > 0) addImage(context, 'banner_red_bottom', 50, 271);
						addImage(context, 'banner_red_bottom', 50, 271 + secondaryBannerOffset);
						addImage(context, 'banner_red_top', 50, 0);
						placeSecondary(586 + secondaryBannerOffset);
						break;
					case 6:
						if (secondaryBannerOffset > 0) addImage(context, 'banner_red_bottom', 50, 210);
						addImage(context, 'banner_red_bottom', 50, 210 + secondaryBannerOffset);
						addImage(context, 'banner_red_top', 50, 0);
						placeSecondary(525 + secondaryBannerOffset);
						break;
					default:
						if (secondaryBannerOffset > 0) addImage(context, 'banner_red_bottom', 50, 150);
						addImage(context, 'banner_red_bottom', 50, 150 + secondaryBannerOffset);
						addImage(context, 'banner_red_top', 50, 0);
						placeSecondary(465 + secondaryBannerOffset);
						break;
				}
			} else {
				switch (descriptionHeight) {
					case 1:
					case 2:
					case 3:
					case 4:
					case 5:
					case 6:
						if (secondaryBannerOffset > 0) addImage(context, 'banner_red_bottom', 50, 330);
						addImage(context, 'banner_red_bottom', 50, 330 + secondaryBannerOffset);
						addImage(context, 'banner_red_top', 50, 0);
						placeSecondary(645 + secondaryBannerOffset);
						break;
					case 7:
						if (secondaryBannerOffset > 0) addImage(context, 'banner_red_bottom', 50, 271);
						addImage(context, 'banner_red_bottom', 50, 271 + secondaryBannerOffset);
						addImage(context, 'banner_red_top', 50, 0);
						placeSecondary(586 + secondaryBannerOffset);
						break;
					default:
						if (secondaryBannerOffset > 0) addImage(context, 'banner_red_bottom', 50, 210);
						addImage(context, 'banner_red_bottom', 50, 210 + secondaryBannerOffset);
						addImage(context, 'banner_red_top', 50, 0);
						placeSecondary(525 + secondaryBannerOffset);
						break;
				}
			}
			break;
		case Color.BLUE:
			if (level == 'ii' || level == 'iii') {
				switch (descriptionHeight) {
					case 1:
					case 2:
					case 3:
					case 4:
						if (secondaryBannerOffset > 0) addImage(context, 'banner_blue_bottom', 50, 318);
						addImage(context, 'banner_blue_bottom', 50, 318 + secondaryBannerOffset);
						addImage(context, 'banner_blue_top', 50, 0);
						placeSecondary(645 + secondaryBannerOffset);
						break;
					case 5:
						if (secondaryBannerOffset > 0) addImage(context, 'banner_blue_bottom', 50, 259);
						addImage(context, 'banner_blue_bottom', 50, 259 + secondaryBannerOffset);
						addImage(context, 'banner_blue_top', 50, 0);
						placeSecondary(586 + secondaryBannerOffset);
						break;
					case 6:
						if (secondaryBannerOffset > 0) addImage(context, 'banner_blue_bottom', 50, 198);
						addImage(context, 'banner_blue_bottom', 50, 198 + secondaryBannerOffset);
						addImage(context, 'banner_blue_top', 50, 0);
						placeSecondary(525 + secondaryBannerOffset);
						break;
					default:
						if (secondaryBannerOffset > 0) addImage(context, 'banner_blue_bottom', 50, 138);
						addImage(context, 'banner_blue_bottom', 50, 138 + secondaryBannerOffset);
						addImage(context, 'banner_blue_top', 50, 0);
						placeSecondary(465 + secondaryBannerOffset);
						break;
				}
			} else {
				switch (descriptionHeight) {
					case 1:
					case 2:
					case 3:
					case 4:
					case 5:
					case 6:
						if (secondaryBannerOffset > 0) addImage(context, 'banner_blue_bottom', 50, 318);
						addImage(context, 'banner_blue_bottom', 50, 318 + secondaryBannerOffset);
						addImage(context, 'banner_blue_top', 50, 0);
						placeSecondary(645 + secondaryBannerOffset);
						break;
					case 7:
						if (secondaryBannerOffset > 0) addImage(context, 'banner_blue_bottom', 50, 259);
						addImage(context, 'banner_blue_bottom', 50, 259 + secondaryBannerOffset);
						addImage(context, 'banner_blue_top', 50, 0);
						placeSecondary(586 + secondaryBannerOffset);
						break;
					default:
						if (secondaryBannerOffset > 0) addImage(context, 'banner_blue_bottom', 50, 198);
						addImage(context, 'banner_blue_bottom', 50, 198 + secondaryBannerOffset);
						addImage(context, 'banner_blue_top', 50, 0);
						placeSecondary(525 + secondaryBannerOffset);
						break;
				}
			}
			break;
		case Color.GREEN:
			if (level == 'ii' || level == 'iii') {
				switch (descriptionHeight) {
					case 1:
					case 2:
					case 3:
					case 4:
						if (secondaryBannerOffset > 0) addImage(context, 'banner_green_bottom', 50, 325);
						addImage(context, 'banner_green_bottom', 50, 325 + secondaryBannerOffset);
						addImage(context, 'banner_green_top', 50, 0);
						placeSecondary(645 + secondaryBannerOffset);
						break;
					case 5:
						if (secondaryBannerOffset > 0) addImage(context, 'banner_green_bottom', 50, 266);
						addImage(context, 'banner_green_bottom', 50, 266 + secondaryBannerOffset);
						addImage(context, 'banner_green_top', 50, 0);
						placeSecondary(586 + secondaryBannerOffset);
						break;
					case 6:
						if (secondaryBannerOffset > 0) addImage(context, 'banner_green_bottom', 50, 205);
						addImage(context, 'banner_green_bottom', 50, 205 + secondaryBannerOffset);
						addImage(context, 'banner_green_top', 50, 0);
						placeSecondary(525 + secondaryBannerOffset);
						break;
					default:
						if (secondaryBannerOffset > 0) addImage(context, 'banner_green_bottom', 50, 145);
						addImage(context, 'banner_green_bottom', 50, 145 + secondaryBannerOffset);
						addImage(context, 'banner_green_top', 50, 0);
						placeSecondary(465 + secondaryBannerOffset);
						break;
				}
			} else {
				switch (descriptionHeight) {
					case 1:
					case 2:
					case 3:
					case 4:
					case 5:
					case 6:
						if (secondaryBannerOffset > 0) addImage(context, 'banner_green_bottom', 50, 325);
						addImage(context, 'banner_green_bottom', 50, 325 + secondaryBannerOffset);
						addImage(context, 'banner_green_top', 50, 0);
						placeSecondary(645 + secondaryBannerOffset);
						break;
					case 7:
						if (secondaryBannerOffset > 0) addImage(context, 'banner_green_bottom', 50, 266);
						addImage(context, 'banner_green_bottom', 50, 266 + secondaryBannerOffset);
						addImage(context, 'banner_green_top', 50, 0);
						placeSecondary(586 + secondaryBannerOffset);
						break;
					default:
						if (secondaryBannerOffset > 0) addImage(context, 'banner_green_bottom', 50, 205);
						addImage(context, 'banner_green_bottom', 50, 205 + secondaryBannerOffset);
						addImage(context, 'banner_green_top', 50, 0);
						placeSecondary(525 + secondaryBannerOffset);
						break;
				}
			}
			break;
	}

	if (color != Color.PURPLE) {
		addImage(context, 'initiative', 26, 13);
		addInitiative(
			context,
			initiative + initiativeBonus,
			143,
			192,
			initiativeBonus,
			showNumbers,
			color,
			level,
			initiativeStat
		);
	}

	const cardType = getCardTypeLabel(color, primaryActionType, modifier, labels);

	let primaryActionHeight;

	const lowerColor = color.toLowerCase();

	if (
		(level == 'ii' || level == 'iii') &&
		(color == Color.RED || color == Color.BLUE || color == Color.GREEN)
	) {
		addImage(context, 'bottom_long', 0, 1412);

		switch (descriptionHeight) {
			case 1:
				addImage(context, 'frame_empty_bottom', 56, 1415);
				addImage(context, 'frame_' + lowerColor + '_middle', 56, 1249);
				addImage(context, 'frame_' + lowerColor + '_top', 56, 1137);
				addImage(context, 'frame_' + lowerColor + '_middle_cut', 56, 1340);
				addCardDescription(context, customEmoji, description, 596, 1358);
				addCardType(context, cardType, 596, 1200);
				primaryActionHeight = 1137;
				break;
			case 2:
				addImage(context, 'frame_empty_bottom', 56, 1415);
				addImage(context, 'frame_' + lowerColor + '_middle', 56, 1249);
				addImage(context, 'frame_' + lowerColor + '_top', 56, 1098);
				addImage(context, 'frame_' + lowerColor + '_middle_cut', 56, 1340);
				addCardDescription(context, customEmoji, descriptionLines[0], 596, 1311);
				addCardDescription(context, customEmoji, descriptionLines[1], 596, 1372);
				addCardType(context, cardType, 596, 1161);
				primaryActionHeight = 1098;
				break;
			case 3:
				addImage(context, 'frame_empty_bottom', 56, 1415);
				addImage(context, 'frame_' + lowerColor + '_middle', 56, 1249);
				addImage(context, 'frame_' + lowerColor + '_middle', 56, 1216);
				addImage(context, 'frame_' + lowerColor + '_top', 56, 1065);
				addImage(context, 'frame_' + lowerColor + '_middle_cut', 56, 1340);
				addCardDescription(context, customEmoji, descriptionLines[0], 596, 1262);
				addCardDescription(context, customEmoji, descriptionLines[1], 596, 1323);
				addCardDescription(context, customEmoji, descriptionLines[2], 596, 1387);
				addCardType(context, cardType, 596, 1128);
				primaryActionHeight = 1065;
				break;
			case 4:
				addImage(context, 'frame_empty_bottom', 56, 1415);
				addImage(context, 'frame_' + lowerColor + '_middle', 56, 1249);
				addImage(context, 'frame_' + lowerColor + '_middle', 56, 1083);
				addImage(context, 'frame_' + lowerColor + '_top', 56, 1002);
				addImage(context, 'frame_' + lowerColor + '_middle_cut', 56, 1340);
				addCardDescription(context, customEmoji, descriptionLines[0], 596, 1198);
				addCardDescription(context, customEmoji, descriptionLines[1], 596, 1259);
				addCardDescription(context, customEmoji, descriptionLines[2], 596, 1323);
				addCardDescription(context, customEmoji, descriptionLines[3], 596, 1387);
				addCardType(context, cardType, 596, 1065);
				primaryActionHeight = 1002;
				break;
			case 5:
				addImage(context, 'frame_empty_bottom', 56, 1415);
				addImage(context, 'frame_' + lowerColor + '_middle', 56, 1249);
				addImage(context, 'frame_' + lowerColor + '_middle', 56, 1083);
				addImage(context, 'frame_' + lowerColor + '_top', 56, 937);
				addImage(context, 'frame_' + lowerColor + '_middle_cut', 56, 1340);
				addCardDescription(context, customEmoji, descriptionLines[0], 596, 1134);
				addCardDescription(context, customEmoji, descriptionLines[1], 596, 1198);
				addCardDescription(context, customEmoji, descriptionLines[2], 596, 1259);
				addCardDescription(context, customEmoji, descriptionLines[3], 596, 1323);
				addCardDescription(context, customEmoji, descriptionLines[4], 596, 1387);
				addCardType(context, cardType, 596, 1000);
				primaryActionHeight = 937;
				break;
			case 6:
				addImage(context, 'frame_empty_bottom', 56, 1415);
				addImage(context, 'frame_' + lowerColor + '_middle', 56, 1249);
				addImage(context, 'frame_' + lowerColor + '_middle', 56, 1083);
				addImage(context, 'frame_' + lowerColor + '_middle', 56, 1015);
				addImage(context, 'frame_' + lowerColor + '_top', 56, 864);
				addImage(context, 'frame_' + lowerColor + '_middle_cut', 56, 1340);
				addCardDescription(context, customEmoji, descriptionLines[0], 596, 1064);
				addCardDescription(context, customEmoji, descriptionLines[1], 596, 1128);
				addCardDescription(context, customEmoji, descriptionLines[2], 596, 1189);
				addCardDescription(context, customEmoji, descriptionLines[3], 596, 1253);
				addCardDescription(context, customEmoji, descriptionLines[4], 596, 1314);
				addCardDescription(context, customEmoji, descriptionLines[5], 596, 1378);
				addCardType(context, cardType, 596, 927);
				primaryActionHeight = 864;
				break;
			default:
				addImage(context, 'frame_empty_bottom', 56, 1415);
				addImage(context, 'frame_' + lowerColor + '_middle', 56, 1249);
				addImage(context, 'frame_' + lowerColor + '_middle', 56, 1083);
				addImage(context, 'frame_' + lowerColor + '_middle', 56, 1015);
				addImage(context, 'frame_' + lowerColor + '_middle', 56, 987);
				addImage(context, 'frame_' + lowerColor + '_top', 56, 836);
				addImage(context, 'frame_' + lowerColor + '_middle_cut', 56, 1340);
				addCardDescription(context, customEmoji, descriptionLines[0], 596, 1019);
				addCardDescription(context, customEmoji, descriptionLines[1], 596, 1083);
				addCardDescription(context, customEmoji, descriptionLines[2], 596, 1144);
				addCardDescription(context, customEmoji, descriptionLines[3], 596, 1208);
				addCardDescription(context, customEmoji, descriptionLines[4], 596, 1269);
				addCardDescription(context, customEmoji, descriptionLines[5], 596, 1333);
				addCardDescription(context, customEmoji, descriptionLines[6], 596, 1397);
				addCardType(context, cardType, 596, 899);
				primaryActionHeight = 836;
				break;
		}
	} else {
		addImage(context, 'bottom_short', 0, 1413);

		switch (descriptionHeight) {
			case 1:
				addImage(context, 'frame_' + lowerColor + '_bottom', 56, 1522);
				addImage(context, 'frame_' + lowerColor + '_middle', 56, 1356);
				addImage(context, 'frame_' + lowerColor + '_top', 56, 1244);
				addCardDescription(context, customEmoji, description, 596, 1465);
				addCardType(context, cardType, 596, 1307);
				primaryActionHeight = 1244;
				break;
			case 2:
				addImage(context, 'frame_' + lowerColor + '_bottom', 56, 1522);
				addImage(context, 'frame_' + lowerColor + '_middle', 56, 1356);
				addImage(context, 'frame_' + lowerColor + '_top', 56, 1205);
				addCardDescription(context, customEmoji, descriptionLines[0], 596, 1418);
				addCardDescription(context, customEmoji, descriptionLines[1], 596, 1479);
				addCardType(context, cardType, 596, 1268);
				primaryActionHeight = 1205;
				break;
			case 3:
				addImage(context, 'frame_' + lowerColor + '_bottom', 56, 1522);
				addImage(context, 'frame_' + lowerColor + '_middle', 56, 1356);
				addImage(context, 'frame_' + lowerColor + '_middle', 56, 1323);
				addImage(context, 'frame_' + lowerColor + '_top', 56, 1172);
				addCardDescription(context, customEmoji, descriptionLines[0], 596, 1369);
				addCardDescription(context, customEmoji, descriptionLines[1], 596, 1430);
				addCardDescription(context, customEmoji, descriptionLines[2], 596, 1494);
				addCardType(context, cardType, 596, 1235);
				primaryActionHeight = 1172;
				break;
			case 4:
				addImage(context, 'frame_' + lowerColor + '_bottom', 56, 1522);
				addImage(context, 'frame_' + lowerColor + '_middle', 56, 1356);
				addImage(context, 'frame_' + lowerColor + '_middle', 56, 1190);
				addImage(context, 'frame_' + lowerColor + '_top', 56, 1109);
				addCardDescription(context, customEmoji, descriptionLines[0], 596, 1305);
				addCardDescription(context, customEmoji, descriptionLines[1], 596, 1366);
				addCardDescription(context, customEmoji, descriptionLines[2], 596, 1430);
				addCardDescription(context, customEmoji, descriptionLines[3], 596, 1494);
				addCardType(context, cardType, 596, 1172);
				primaryActionHeight = 1109;
				break;
			case 5:
				addImage(context, 'frame_' + lowerColor + '_bottom', 56, 1522);
				addImage(context, 'frame_' + lowerColor + '_middle', 56, 1356);
				addImage(context, 'frame_' + lowerColor + '_middle', 56, 1190);
				addImage(context, 'frame_' + lowerColor + '_top', 56, 1044);
				addCardDescription(context, customEmoji, descriptionLines[0], 596, 1241);
				addCardDescription(context, customEmoji, descriptionLines[1], 596, 1305);
				addCardDescription(context, customEmoji, descriptionLines[2], 596, 1366);
				addCardDescription(context, customEmoji, descriptionLines[3], 596, 1430);
				addCardDescription(context, customEmoji, descriptionLines[4], 596, 1494);
				addCardType(context, cardType, 596, 1107);
				primaryActionHeight = 1044;
				break;
			case 6:
				addImage(context, 'frame_' + lowerColor + '_bottom', 56, 1522);
				addImage(context, 'frame_' + lowerColor + '_middle', 56, 1356);
				addImage(context, 'frame_' + lowerColor + '_middle', 56, 1190);
				addImage(context, 'frame_' + lowerColor + '_middle', 56, 1122);
				addImage(context, 'frame_' + lowerColor + '_top', 56, 971);
				addCardDescription(context, customEmoji, descriptionLines[0], 596, 1171);
				addCardDescription(context, customEmoji, descriptionLines[1], 596, 1235);
				addCardDescription(context, customEmoji, descriptionLines[2], 596, 1296);
				addCardDescription(context, customEmoji, descriptionLines[3], 596, 1360);
				addCardDescription(context, customEmoji, descriptionLines[4], 596, 1421);
				addCardDescription(context, customEmoji, descriptionLines[5], 596, 1485);
				addCardType(context, cardType, 596, 1034);
				primaryActionHeight = 971;
				break;
			case 7:
				addImage(context, 'frame_' + lowerColor + '_bottom', 56, 1522);
				addImage(context, 'frame_' + lowerColor + '_middle', 56, 1356);
				addImage(context, 'frame_' + lowerColor + '_middle', 56, 1190);
				addImage(context, 'frame_' + lowerColor + '_middle', 56, 1122);
				addImage(context, 'frame_' + lowerColor + '_middle', 56, 1094);
				addImage(context, 'frame_' + lowerColor + '_top', 56, 943);
				addCardDescription(context, customEmoji, descriptionLines[0], 596, 1126);
				addCardDescription(context, customEmoji, descriptionLines[1], 596, 1190);
				addCardDescription(context, customEmoji, descriptionLines[2], 596, 1251);
				addCardDescription(context, customEmoji, descriptionLines[3], 596, 1315);
				addCardDescription(context, customEmoji, descriptionLines[4], 596, 1376);
				addCardDescription(context, customEmoji, descriptionLines[5], 596, 1440);
				addCardDescription(context, customEmoji, descriptionLines[6], 596, 1504);
				addCardType(context, cardType, 596, 1006);
				primaryActionHeight = 943;
				break;
			default:
				addImage(context, 'frame_' + lowerColor + '_bottom', 56, 1552);
				addImage(context, 'frame_' + lowerColor + '_middle', 56, 1386);
				addImage(context, 'frame_' + lowerColor + '_middle', 56, 1326);
				addImage(context, 'frame_' + lowerColor + '_middle', 56, 1190);
				addImage(context, 'frame_' + lowerColor + '_middle', 56, 1122);
				addImage(context, 'frame_' + lowerColor + '_middle', 56, 1074);
				addImage(context, 'frame_' + lowerColor + '_top', 56, 923);
				addCardDescription(context, customEmoji, descriptionLines[0], 596, 1098);
				addCardDescription(context, customEmoji, descriptionLines[1], 596, 1159);
				addCardDescription(context, customEmoji, descriptionLines[2], 596, 1222);
				addCardDescription(context, customEmoji, descriptionLines[3], 596, 1286);
				addCardDescription(context, customEmoji, descriptionLines[4], 596, 1347);
				addCardDescription(context, customEmoji, descriptionLines[5], 596, 1411);
				addCardDescription(context, customEmoji, descriptionLines[6], 596, 1472);
				addCardDescription(context, customEmoji, descriptionLines[7], 596, 1536);
				addCardType(context, cardType, 596, 986);
				primaryActionHeight = 923;
				break;
		}
	}

	let modifierValueWidth = 0;
	switch (modifier) {
		case Modifier.AREA:
			addImage(context, `area_${lowerColor}`, 921, primaryActionHeight - 20);
			modifierValueWidth = addModifierValue(
				context,
				modifierValue + areaBonus,
				1052,
				primaryActionHeight + 82,
				areaBonus
			);
			break;
		case Modifier.RANGE:
			addImage(context, `range_${lowerColor}`, 936, primaryActionHeight - 77);
			modifierValueWidth = addModifierValue(
				context,
				modifierValue + rangeBonus,
				1052,
				primaryActionHeight + 82,
				rangeBonus
			);
			break;
	}
	if (
		(modifier == Modifier.AREA || modifier == Modifier.RANGE) &&
		(modifierValueSign == ValueSign.PLUS || modifierValueSign == ValueSign.MINUS)
	) {
		addSign(
			context,
			modifierValueSign == ValueSign.PLUS ? '+' : '-',
			1052 + modifierValueWidth / 2,
			primaryActionHeight + 82
		);
	}

	addImage(context, `colorblind_${lowerColor}`, 1116, 46);

	if (color == Color.RED || color == Color.BLUE || color == Color.GREEN) {
		addImage(context, `level_${level}`, 1006, 85);

		if (level == 'ii' || level == 'iii') addImage(context, `item_${item.toLowerCase()}`, 476, 1484);
	}

	if (color == Color.GOLD || color == Color.SILVER) {
		if (extra) {
			addExtraMarker(context);
		} else if (handicap) {
			addImage(context, 'level_h', 1008, 85);
		}
	}

	if (color == Color.PURPLE) {
		addImage(context, 'level_iv', 1008, 85);
	} else {
		let primaryValueWidth = 0;
		switch (primaryActionType) {
			case Type.SKILL:
				addImage(context, `skill_${lowerColor}`, 22, primaryActionHeight - 79);
				break;
			case Type.ATTACK:
				addImage(context, `attack_${lowerColor}`, 19, primaryActionHeight - 82);
				if (primaryActionValueSign != ValueSign.EXCLAMATION)
					primaryValueWidth = addPrimaryValue(
						context,
						primaryActionValue + attackBonus,
						142,
						primaryActionHeight + 82,
						attackBonus,
						showNumbers,
						color,
						level,
						Stat.ATTACK,
						attackStat
					);
				break;
			case Type.MOVEMENT:
				addImage(context, `movement_${lowerColor}`, 43, primaryActionHeight - 68);
				if (primaryActionValueSign != ValueSign.EXCLAMATION)
					primaryValueWidth = addPrimaryValue(
						context,
						primaryActionValue + movementBonus,
						142,
						primaryActionHeight + 82,
						movementBonus,
						showNumbers,
						color,
						level,
						Stat.MOVEMENT,
						movementStat
					);
				break;
			case Type.DEFENSE:
				addImage(context, `defense_${lowerColor}`, 51, primaryActionHeight - 74);
				if (primaryActionValueSign != ValueSign.EXCLAMATION)
					primaryValueWidth = addPrimaryValue(
						context,
						primaryActionValue + defenseBonus,
						142,
						primaryActionHeight + 82,
						defenseBonus,
						showNumbers,
						color,
						level,
						Stat.DEFENSE,
						defenseStat
					);
				break;
			case Type.DEFENSE_SKILL:
				addImage(context, `defense_skill_${lowerColor}`, 51, primaryActionHeight - 74);
				if (primaryActionValueSign != ValueSign.EXCLAMATION)
					primaryValueWidth = addPrimaryValue(
						context,
						primaryActionValue + defenseBonus,
						142,
						primaryActionHeight + 82,
						defenseBonus,
						showNumbers,
						color,
						level,
						Stat.DEFENSE,
						defenseStat
					);
				break;
		}

		if (primaryActionType != Type.SKILL && primaryActionValueSign != ValueSign.NONE) {
			if (primaryActionValueSign == ValueSign.EXCLAMATION)
				addBlockValue(context, '!', 142, primaryActionHeight + 82);
			else
				addSign(
					context,
					primaryActionValueSign == ValueSign.PLUS ? '+' : '-',
					142 + primaryValueWidth / 2,
					primaryActionHeight + 82
				);
		}
	}
}

import {
	cardStats,
	Color,
	defaultEmoji,
	imageNames,
	Item,
	Modifier,
	Stat,
	Type,
	ValueSign
} from './painterTypes';

export const images: Map<string, HTMLImageElement> = new Map();
const imageLoads = new Map<string, Promise<HTMLImageElement>>();
let cardDescriptionIndent = 490
let descriptionFontSizeAdjustment = 0
let assetBaseUrl = "/goa2-cards"

function assetUrl(path: string): string {
  return `${assetBaseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`
}

/**
 * Configure the public URL that contains this package's `assets` directory.
 *
 * Consumers commonly copy `assets/` to `/goa2-cards/` and keep the default.
 */
export function setPainterAssetBaseUrl(baseUrl: string): void {
  if (baseUrl.trim() === "") {
    throw new Error("Painter asset base URL cannot be empty")
  }
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "")
  if (normalizedBaseUrl === assetBaseUrl) return
  assetBaseUrl = normalizedBaseUrl
  images.clear()
  imageLoads.clear()
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Failed to load ${url}`))
    image.src = url
  })
}

function canonicalImageName(imageName: string): string {
  // Stats uses `radius_silver` in one description while the sprite sheet
  // names the same icon `area_silver`.
  return imageName === "radius_silver" ? "area_silver" : imageName
}

function preloadImage(imageName: string): Promise<HTMLImageElement> {
  const canonicalName = canonicalImageName(imageName)
  const loaded = images.get(canonicalName)
  if (loaded !== undefined) return Promise.resolve(loaded)

  const pending = imageLoads.get(canonicalName)
  if (pending !== undefined) return pending

  const imageLoad = loadImage(assetUrl(`sheets/${canonicalName}.png`))
    .then((image) => {
      images.set(canonicalName, image)
      if (canonicalName === "area_silver") images.set("radius_silver", image)
      return image
    })
    .catch((reason: unknown) => {
      imageLoads.delete(canonicalName)
      throw reason
    })
  imageLoads.set(canonicalName, imageLoad)
  return imageLoad
}

export function preloadImages(requestedImageNames: readonly string[] = imageNames) {
  return Promise.all(
    [...new Set(requestedImageNames.map(canonicalImageName))].map(preloadImage),
  )
}

export async function importCardImage(hero: string, card: string) {
  try {
    return await loadImage(assetUrl(`backgrounds/${hero}/${card}.webp`))
  } catch {
    return undefined
  }
}

/**
 * A spell card is a finished landscape face rather than something the painter
 * composes, so a translated one is a separate image. Locales that have not been
 * given their own faces fall back to the English ones.
 */
export async function importSpellImage(card: string, locale?: string) {
  if (locale !== undefined) {
    try {
      return await loadImage(assetUrl(`spells/${locale}/${card}.webp`))
    } catch {
      // The locale has no translated face for this spell.
    }
  }
  try {
    return await loadImage(assetUrl(`spells/${card}.webp`))
  } catch {
    return undefined
  }
}

function clear(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D): void {
  context.clearRect(0, 0, canvas.width, canvas.height)
}

function addImage(context: CanvasRenderingContext2D, name: string, x: number, y: number): void {
  context.drawImage(images.get(name) as CanvasImageSource, x, y)
}

function addEmoji(context: CanvasRenderingContext2D, name: string, x: number, y: number): void {
  const img = images.get(name) as HTMLImageElement
  context.drawImage(img, x, y, 64 * img.width / img.height, 64)
}

function addCustomEmoji(context: CanvasRenderingContext2D, customEmoji: Array<[string, HTMLImageElement]>, name: string, x: number, y: number): void {
  const img = customEmoji.find(item => item[0] == name)![1]
  context.drawImage(img, x, y, 64 * img.width / img.height, 64)
}

function addCardDescription(context: CanvasRenderingContext2D, customEmoji: Array<[string, HTMLImageElement]>, text: string, x: number, y: number): void {
  if (text == "---") {
    context.beginPath()
    context.moveTo(x - 381, y - 11)
    context.lineTo(x + 381, y - 11)
    context.lineWidth = 2
    context.stroke()
  } else if (text.startsWith(">>")) {
    addTextWithBold(context, customEmoji, "•  " + text.substring(2), x - cardDescriptionIndent, y, true)
  } else if (text.startsWith(">")) {
    addTextWithBold(context, customEmoji, text.substring(1), x - (cardDescriptionIndent - 45), y, true)
  } else
    addTextWithBold(context, customEmoji, text, x, y)
}

type RichTextSegment = { type: "text", value: string, bold: boolean, italic: boolean } | { type: "emoji", value: string }

export function getCardTypeLabel(
  color: Color,
  primaryActionType: Type,
  modifier: Modifier,
  labels?: PainterLabels,
): string {
  const painterLabels = labels ?? ENGLISH_PAINTER_LABELS
  if (color == Color.PURPLE) return painterLabels.ultimate

  const basic = color == Color.GOLD || color == Color.SILVER
  let cardType = ""
  switch (primaryActionType) {
    case Type.SKILL:
      cardType = basic ? painterLabels.basicSkill : painterLabels.skill
      break
    case Type.ATTACK:
      cardType = basic ? painterLabels.basicAttack : painterLabels.attack
      break
    case Type.MOVEMENT:
      cardType = basic ? painterLabels.basicMovement : painterLabels.movement
      break
    case Type.DEFENSE:
      cardType = basic ? painterLabels.basicDefense : painterLabels.defense
      break
    case Type.DEFENSE_SKILL:
      if (basic) {
        cardType = modifier != Modifier.NONE
          ? painterLabels.basicDefenseSkillCompact ?? painterLabels.basicDefenseSkill
          : painterLabels.basicDefenseSkill
      } else {
        cardType = painterLabels.defenseSkill
      }
      break
  }
  if (modifier == Modifier.RANGE) cardType += ` - ${painterLabels.ranged}`
  return cardType
}

function getDescriptionMaxLineWidth(context: CanvasRenderingContext2D, descriptionLines: string[], fontSizeAdjustment: number): number {
  let longestLineWidth = 0

  descriptionLines.forEach(line => {
    if (line.startsWith(">>")) {
      longestLineWidth = Math.max(longestLineWidth, getRichTextWidth(context, "•  " + line.substring(2), fontSizeAdjustment))
    } else if (line.startsWith(">")) {
      longestLineWidth = Math.max(longestLineWidth, getRichTextWidth(context, line.substring(1), fontSizeAdjustment) + 45)
    } else if (line !== "---") {
      longestLineWidth = Math.max(longestLineWidth, getRichTextWidth(context, line, fontSizeAdjustment))
    }
  })

  return longestLineWidth
}

function isHardDescriptionBoundary(line: string): boolean {
  return (
    line === "" ||
    line === "---" ||
    line.startsWith(">>") ||
    line.startsWith(">") ||
    line.includes("~")
  )
}

export function reflowDescriptionSourceLines(lines: string[]): string[] {
  const reflowed: string[] = []
  let paragraph = ""

  const flushParagraph = (): void => {
    if (paragraph !== "") reflowed.push(paragraph)
    paragraph = ""
  }

  for (const line of lines) {
    if (isHardDescriptionBoundary(line)) {
      flushParagraph()
      reflowed.push(line)
    } else {
      const text = line.trim()
      if (text !== "") {
        const joinsCjkText = CJK_SCRIPT.test(paragraph) || CJK_SCRIPT.test(text)
        paragraph += `${paragraph === "" || joinsCjkText ? "" : " "}${text}`
      }
    }
  }
  flushParagraph()
  return reflowed
}

interface BreakableDescription {
  text: string
  rawOffsets: number[]
}

/**
 * Remove zero-width painter markup before applying Unicode line breaking while
 * retaining a mapping back to the stored painter string. Sprites become one
 * object-replacement character so the breaker treats each as an atomic glyph.
 */
function getBreakableDescription(raw: string): BreakableDescription {
  let text = ""
  let rawIndex = 0
  const rawOffsets = [0]

  const advanceMarkup = (length: number): void => {
    rawIndex += length
    rawOffsets[text.length] = rawIndex
  }
  const appendVisible = (visible: string, rawLength: number): void => {
    rawIndex += rawLength
    text += visible
    for (let index = text.length - visible.length + 1; index <= text.length; index += 1) {
      rawOffsets[index] = rawIndex
    }
  }

  while (rawIndex < raw.length) {
    if (raw.startsWith("**", rawIndex)) {
      advanceMarkup(2)
      continue
    }
    if (raw[rawIndex] === "~") {
      advanceMarkup(1)
      continue
    }
    if (raw.startsWith("::", rawIndex)) {
      const closingIndex = raw.indexOf("::", rawIndex + 2)
      if (closingIndex !== -1) {
        appendVisible("\ufffc", closingIndex + 2 - rawIndex)
        continue
      }
    }
    const codePoint = raw.codePointAt(rawIndex)
    if (codePoint === undefined) break
    const visible = String.fromCodePoint(codePoint)
    appendVisible(visible, visible.length)
  }

  return { text, rawOffsets }
}

/** Return raw painter-text chunks at Unicode UAX #14 break opportunities. */
export function getUnicodeLineBreakTokens(raw: string): string[] {
  const breakable = getBreakableDescription(raw)
  const breaker = new LineBreaker(breakable.text)
  const positions: number[] = []
  let next = breaker.nextBreak()
  while (next !== null) {
    positions.push(next.position)
    next = breaker.nextBreak()
  }
  if (positions.at(-1) !== breakable.text.length) {
    positions.push(breakable.text.length)
  }

  const tokens: string[] = []
  let rawStart = 0
  for (const position of positions) {
    const rawEnd = breakable.rawOffsets[position]
    if (rawEnd !== undefined && rawEnd > rawStart) {
      tokens.push(raw.slice(rawStart, rawEnd))
      rawStart = rawEnd
    }
  }
  if (rawStart < raw.length) {
    const suffix = raw.slice(rawStart)
    if (tokens.length === 0) tokens.push(suffix)
    else tokens[tokens.length - 1] += suffix
  }
  return tokens
}

export function getWrappedDescriptionPrefix(
  prefix: string,
  firstChunk: boolean,
): string {
  if (prefix === ">>") return firstChunk ? ">>" : ">"
  return prefix
}

/**
 * Bold and italic markers left open at the end of a wrapped chunk. Each chunk
 * is painted by its own `addTextWithBold` call, which always starts unstyled,
 * so a span crossing a wrap has to be closed here and re-opened on the next
 * line. Bold and italic toggle independently, which is why emitting them in a
 * fixed order is safe, and why a `~` re-opened under a `~` line prefix
 * correctly continues the un-italic state the prefix already flipped on.
 */
function getOpenMarkupMarkers(body: string): string {
  let bold = false
  let italic = false
  let index = 0

  while (index < body.length) {
    if (body.startsWith("**", index)) {
      bold = !bold
      index += 2
      continue
    }
    if (body[index] === "~") {
      italic = !italic
      index += 1
      continue
    }
    if (body.startsWith("::", index)) {
      const closingIndex = body.indexOf("::", index + 2)
      if (closingIndex !== -1) {
        index = closingIndex + 2
        continue
      }
    }
    index += 1
  }

  return `${bold ? "**" : ""}${italic ? "~" : ""}`
}

export function wrapDescriptionLines(
  context: CanvasRenderingContext2D,
  lines: string[],
  maxWidth: number,
  fontSizeAdjustment: number,
): string[] {
  const out: string[] = []
  for (const raw of reflowDescriptionSourceLines(lines)) {
    if (raw === "---" || raw === "") {
      out.push(raw)
      continue
    }
    let prefix = ""
    let body = raw
    if (raw.startsWith(">>")) { prefix = ">>"; body = raw.substring(2) }
    else if (raw.startsWith(">")) { prefix = ">"; body = raw.substring(1) }
    else if (raw.startsWith("~")) { prefix = "~"; body = raw.substring(1) }

    const measure = (s: string, chunkPrefix: string): number => {
      if (chunkPrefix === ">>") {
        return getRichTextWidth(context, `•  ${s}`, fontSizeAdjustment)
      }
      if (chunkPrefix === "~") {
        return getRichTextWidth(context, `~${s}`, fontSizeAdjustment)
      }
      const indentation = chunkPrefix === ">" ? 45 : 0
      return getRichTextWidth(context, s, fontSizeAdjustment) + indentation
    }
    if (measure(body, getWrappedDescriptionPrefix(prefix, true)) <= maxWidth) {
      out.push(raw)
      continue
    }

    // Preserve the established whitespace wrapping for Latin text. CJK text
    // uses Unicode line-break opportunities because it normally has no spaces.
    const words = CJK_SCRIPT.test(body)
      ? getUnicodeLineBreakTokens(body)
      : body.split(/(\s+)/) // keep whitespace tokens to rebuild faithfully
    let current = ""
    let firstChunk = true
    let reopened = ""
    const pushChunk = (chunkPrefix: string): void => {
      const chunk = `${reopened}${current.trimEnd()}`
      const markers = getOpenMarkupMarkers(chunk)
      out.push(`${chunkPrefix}${chunk}${markers}`)
      reopened = markers
    }
    for (const token of words) {
      if (token === "") continue
      const candidate = current + token
      const chunkPrefix = getWrappedDescriptionPrefix(prefix, firstChunk)
      if (measure(reopened + candidate, chunkPrefix) <= maxWidth || current === "") {
        current = candidate
      } else {
        pushChunk(chunkPrefix)
        firstChunk = false
        // start the next line with the non-whitespace token (skip leading space)
        current = /^\s+$/.test(token) ? "" : token
      }
    }
    if (current.length > 0) {
      pushChunk(getWrappedDescriptionPrefix(prefix, firstChunk))
    }
  }
  return out
}

function getDescriptionIndent(
  context: CanvasRenderingContext2D,
  descriptionLines: string[],
  fontSizeAdjustment: number,
): number {
  const indentedLines = descriptionLines.filter((line) =>
    line.startsWith(">>") || line.startsWith(">")
  )
  const indentationWidth = getDescriptionMaxLineWidth(
    context,
    indentedLines,
    fontSizeAdjustment,
  )
  return indentationWidth > 980 ? indentationWidth / 2 : 490
}

function getCardDescriptionLayout(
  context: CanvasRenderingContext2D,
  descriptionLines: string[],
  fontSizeAdjustment: number,
): { indent: number, longestLineWidth: number } {
  return {
		indent: getDescriptionIndent(context, descriptionLines, fontSizeAdjustment),
		longestLineWidth: getDescriptionMaxLineWidth(
			context,
			descriptionLines,
			fontSizeAdjustment,
		),
	}
}

interface DescriptionFit {
  lines: string[]
  fontSizeAdjustment: number
}

function fitDescriptionLines(
  context: CanvasRenderingContext2D,
  sourceLines: string[],
  maxWidth: number,
  maxLines: number,
  cardName: string,
): DescriptionFit {
  for (let fontSizeAdjustment = 0; fontSizeAdjustment >= -10; fontSizeAdjustment -= 2) {
    const lines = wrapDescriptionLines(
      context,
      sourceLines,
      maxWidth,
      fontSizeAdjustment,
    )
    const longestLineWidth = getDescriptionMaxLineWidth(
      context,
      lines,
      fontSizeAdjustment,
    )
    if (lines.length <= maxLines && longestLineWidth <= maxWidth) {
      return { lines, fontSizeAdjustment }
    }
  }

  throw new Error(
    `${JSON.stringify(cardName)} description does not fit within ${maxLines} ` +
      "lines at the minimum font size",
  )
}

function parseRichTextSegments(text: string): RichTextSegment[] {
  const segments: RichTextSegment[] = []
  let isBold = false
  let isItalic = false
  let index = 0
  let buffer = ""

  const flushBuffer = () => {
    if (buffer.length > 0) {
      segments.push({ type: "text", value: buffer, bold: isBold, italic: isItalic })
      buffer = ""
    }
  }

  while (index < text.length) {
    if (text.startsWith("**", index)) {
      flushBuffer()
      isBold = !isBold
      index += 2
      continue
    }
    if (text[index] == "~") {
      flushBuffer()
      isItalic = !isItalic
      index += 1
      continue
    }
    if (text.startsWith("::", index)) {
      const closingIndex = text.indexOf("::", index + 2)
      if (closingIndex != -1) {
        flushBuffer()
        segments.push({ type: "emoji", value: text.slice(index + 2, closingIndex) })
        index = closingIndex + 2
        continue
      }
    }
    buffer += text[index]
    index += 1
  }
  flushBuffer()

  return segments
}

function getRichTextSegmentFont(bold: boolean, italic: boolean, fontSizeAdjustment: number = descriptionFontSizeAdjustment): string {
  const baseSize = Math.max(1, 49 + fontSizeAdjustment)
  const italicSize = Math.max(1, 36 + fontSizeAdjustment)
  if (bold && italic)
    return `italic bold ${italicSize}px ${PAINTER_BODY_FONT}`
  if (bold)
    return `bold ${baseSize}px ${PAINTER_BODY_FONT}`
  if (italic)
    return `italic ${italicSize}px ${PAINTER_BODY_FONT}`
  return `${baseSize}px ${PAINTER_BODY_FONT}`
}

function getRichTextWidth(context: CanvasRenderingContext2D, text: string, fontSizeAdjustment: number = descriptionFontSizeAdjustment): number {
  const segments = parseRichTextSegments(text)
  return segments.reduce((sum, segment) => {
    if (segment.type == "emoji")
      return sum + 64
    context.font = getRichTextSegmentFont(segment.bold, segment.italic, fontSizeAdjustment)
    return sum + context.measureText(segment.value).width
  }, 0)
}

function addTextWithBold(context: CanvasRenderingContext2D, customEmoji: Array<[string, HTMLImageElement]>, text: string, x: number, y: number, left: boolean = false): void {
  context.textAlign = "left"
  const segments = parseRichTextSegments(text)

  const fullTextWidth = segments.reduce((sum, segment) => {
    if (segment.type == "emoji")
      return sum + 64
    context.font = getRichTextSegmentFont(segment.bold, segment.italic)
    return sum + context.measureText(segment.value).width
  }, 0)

  let indent = 0
  segments.forEach(segment => {
    if (segment.type == "emoji") {
      if (defaultEmoji.includes(segment.value))
        addEmoji(context, segment.value, x - (left ? 0 : (fullTextWidth / 2)) + indent, y - 50)
      if (customEmoji.find(item => item[0] == segment.value))
        addCustomEmoji(context, customEmoji, segment.value, x - (left ? 0 : (fullTextWidth / 2)) + indent, y - 50)
      indent += 64
    } else {
      context.font = getRichTextSegmentFont(segment.bold, segment.italic)
      const partWidth = context.measureText(segment.value).width
      context.fillText(segment.value, x - (left ? 0 : (fullTextWidth / 2)) + indent, y)
      indent += partWidth
    }
  })
  context.textAlign = "center"
}

function addCardType(context: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  addOutlinedText(context, text, x, y, 54, 6, 604)
}

function addOutlinedText(context: CanvasRenderingContext2D, text: string, x: number, y: number, fontSize: number, outlineSize: number, widthLimit?: number) {
  context.font = `${fontSize}px ${PAINTER_DISPLAY_FONT}`
  context.lineWidth = outlineSize
  context.strokeText(text, x, y, widthLimit)
  context.fillStyle = "white"
  context.fillText(text, x, y, widthLimit)
  context.fillStyle = "black"
}

function addExtraMarker(context: CanvasRenderingContext2D) {
	const previousAlign = context.textAlign
	context.textAlign = "center"
	addOutlinedText(context, ">", 1060, 150, 90, 8)
	context.textAlign = previousAlign
}

function addTitle(context: CanvasRenderingContext2D, text: string, x: number, y: number, widthLimit?: number) {
  context.textAlign = "center"
  context.font = `66px ${PAINTER_DISPLAY_FONT}`
  context.fillText(text, x, y, widthLimit)
}

function addInitiative(context: CanvasRenderingContext2D, value: number, x: number, y: number, bonus: number, showNumbers: boolean, color: Color, level: string, initiativeStat: number) {
  if (showNumbers || color == Color.SILVER)
    addSquishedOutlinedText(context, value.toString(), x, y, 197, 14, 0.92, false, bonus)
  else {
    const supposedValue = cardStats.get(color)!.get(Stat.INITIATIVE)!.get(level)![initiativeStat - 1]
    const difference = value - supposedValue
    let symbol = ""
    if (difference == 1) symbol = "›"
    if (difference > 1) symbol = "»"
    if (difference == -1) symbol = "‹"
    if (difference < -1) symbol = "«"
    addSquishedOutlinedText(context, symbol, x, y + 25, 296, 14, 0.92, false, bonus, false)
  }
}

function addModifierValue(context: CanvasRenderingContext2D, value: number, x: number, y: number, bonus: number = 0): number {
	return addSquishedOutlinedText(context, value.toString(), x, y, 156, 14, 0.875, false, bonus)
}

function addBlockValue(context: CanvasRenderingContext2D, value: string, x: number, y: number, bonus: number = 0): number {
	return addSquishedOutlinedText(context, value, x, y, 156, 14, 0.875, false, bonus)
}

function addPrimaryValue(context: CanvasRenderingContext2D, value: number, x: number, y: number, bonus: number = 0, showNumbers: boolean, color: Color, level: string, stat: Stat, statNumber: number): number {
	if (showNumbers)
		return addSquishedOutlinedText(context, value.toString(), x, y, 156, 14, 0.875, false, bonus)
	else {
		const supposedValue = cardStats.get(color)!.get(stat)!.get(level)![statNumber - 1]
		const difference = value - supposedValue
		let symbol = ""
		if (difference == 1) symbol = "›"
		if (difference > 1) symbol = "»"
		if (difference == -1) symbol = "‹"
		if (difference < -1) symbol = "«"
		return addSquishedOutlinedText(context, symbol, x, y + 18, 244, 14, 0.875, false, bonus, false)
	}
}

function addSign(context: CanvasRenderingContext2D, text: string, x: number, y: number) {
  addSquishedOutlinedText(context, text, x, y, 156, 14, 0.875, true)
}

function addSecondaryValue(context: CanvasRenderingContext2D, value: number, x: number, y: number, bonus: number = 0, showNumbers: boolean, color: Color, level: string, stat: Stat, statNumber: number) {
	if (showNumbers)
		addSquishedOutlinedText(context, value.toString(), x, y, 136, 14, 0.875, false, bonus)
	else {
		const supposedValue = cardStats.get(color)!.get(stat)!.get(level)![statNumber - 1]
		const difference = value - supposedValue
		let symbol = ""
		if (difference == 1) symbol = "›"
		if (difference > 1) symbol = "»"
		if (difference == -1) symbol = "‹"
		if (difference < -1) symbol = "«"
		return addSquishedOutlinedText(context, symbol, x, y + 10, 204, 14, 0.875, false, bonus, false)
	}
}

function addSquishedOutlinedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  outlineSize: number,
  squishness: number,
  left: boolean = false,
  bonus: number = 0,
	showNumbers: boolean = true,
): number {
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = 400
  tempCanvas.height = 400
  const tempContext = tempCanvas.getContext('2d')!
  tempContext.textAlign = left ? "left" : "center"
  tempContext.font = `${fontSize}px ${PAINTER_DISPLAY_FONT}`
  tempContext.lineWidth = outlineSize
  tempContext.strokeText(text, 200, 200)
  switch (bonus) {
    case 0:
      tempContext.fillStyle = "white"
      break
    case 1:
      tempContext.fillStyle = "palegreen"
      break
    case 2:
      tempContext.fillStyle = "powderblue"
      break
    case 3:
      tempContext.fillStyle = "plum"
      break
  }
  tempContext.fillText(text, 200, 200)
  tempContext.fillStyle = "black"

	if (!showNumbers) {
		const tempCanvas2 = document.createElement('canvas')
		tempCanvas2.width = 400
		tempCanvas2.height = 400
		const tempContext2 = tempCanvas2.getContext('2d')!
		tempContext2.rotate(-Math.PI / 2)
		tempContext2.drawImage(tempCanvas, -400, 0)

		context.drawImage(tempCanvas2, 0, 0, 400, 400, x - 200 + 0.3 * fontSize, y - 200 - 0.3 * fontSize, 400, 400)
		return fontSize * 0.4
	} else {
		context.drawImage(tempCanvas, 0, 0, 400, 400, x - 200 * squishness, y - 200, 400 * squishness, 400)
		return tempContext.measureText(text).width * squishness
	}
}
