import { Dex } from "@pkmn/dex";
import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb } from "pdf-lib";

export const STAT_KEYS = ["HP", "Atk", "Def", "SpA", "SpD", "Spe"] as const;
export type StatKey = (typeof STAT_KEYS)[number];

type DexStatKey = "hp" | "atk" | "def" | "spa" | "spd" | "spe";

const DEX_STAT_KEYS: Record<StatKey, DexStatKey> = {
  HP: "hp",
  Atk: "atk",
  Def: "def",
  SpA: "spa",
  SpD: "spd",
  Spe: "spe",
};

const STAT_ALIASES: Record<string, StatKey> = {
  hp: "HP",
  atk: "Atk",
  attack: "Atk",
  def: "Def",
  defense: "Def",
  spa: "SpA",
  "sp.atk": "SpA",
  "sp. atk": "SpA",
  spatk: "SpA",
  "special attack": "SpA",
  spd: "SpD",
  "sp.def": "SpD",
  "sp. def": "SpD",
  spdef: "SpD",
  "special defense": "SpD",
  spe: "Spe",
  speed: "Spe",
};

const CHAMPIONS_IV = 31;
const CHAMPIONS_MAX_STAT_POINTS = 32;
const CHAMPIONS_MAX_TOTAL_STAT_POINTS = 66;
const CHAMPIONS_LEVEL = 50;

type NatureModifier = [boosted: StatKey | null, lowered: StatKey | null];

const NATURE_MODIFIERS: Record<string, NatureModifier> = {
  hardy: [null, null],
  docile: [null, null],
  serious: [null, null],
  bashful: [null, null],
  quirky: [null, null],
  lonely: ["Atk", "Def"],
  adamant: ["Atk", "SpA"],
  naughty: ["Atk", "SpD"],
  brave: ["Atk", "Spe"],
  bold: ["Def", "Atk"],
  impish: ["Def", "SpA"],
  lax: ["Def", "SpD"],
  relaxed: ["Def", "Spe"],
  modest: ["SpA", "Atk"],
  mild: ["SpA", "Def"],
  rash: ["SpA", "SpD"],
  quiet: ["SpA", "Spe"],
  calm: ["SpD", "Atk"],
  gentle: ["SpD", "Def"],
  careful: ["SpD", "SpA"],
  sassy: ["SpD", "Spe"],
  timid: ["Spe", "Atk"],
  hasty: ["Spe", "Def"],
  jolly: ["Spe", "SpA"],
  naive: ["Spe", "SpD"],
};

export type AgeDivision = "Juniors" | "Seniors" | "Masters";

export type TeamSheetMetadata = {
  playerName?: string;
  ageDivision?: AgeDivision;
  trainerName?: string;
  playerId?: string;
  battleTeam?: string;
  dob?: string;
  switchProfile?: string;
};

export type PokemonSet = {
  pokemon: string;
  item: string;
  ability: string;
  level: string;
  nature: string;
  hasNature: boolean;
  hasStatPoints: boolean;
  statPoints: Partial<Record<StatKey, number>>;
  moves: string[];
  stats: Partial<Record<StatKey, string>>;
};

export type PokedexSpecies = {
  name?: string;
  baseSpecies?: string;
  requiredItem?: string;
  isMega?: boolean;
  baseStats: Record<DexStatKey, number>;
};

export type Pokedex = Record<string, PokedexSpecies>;

export type ValidationIssue = {
  field: string;
  message: string;
};

export type TeamSheetValidationResult = {
  team: PokemonSet[];
  issues: ValidationIssue[];
  isValid: boolean;
};

export function toId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function cleanName(name: string): string {
  let cleaned = name.trim();
  if (cleaned.includes(" @ ")) {
    cleaned = cleaned.split(" @ ", 1)[0].trim();
  }

  cleaned = cleaned.replace(/\s*\((?:m|f|genderless)\)\s*[^a-z0-9]*$/i, "").trim();

  const match = cleaned.match(/\(([^)]+)\)\s*[^a-z0-9]*$/i);
  if (!match || match.index === undefined) return cleanSpeciesName(cleaned);

  return cleanSpeciesName(match[1]);
}

function cleanSpeciesName(name: string): string {
  return name.trim().replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, "");
}

export function parseStatsLine(line: string): Partial<Record<StatKey, string>> {
  const out: Partial<Record<StatKey, string>> = {};
  const cleaned = line.replace(/^Stats:\s*/i, "").trim();

  for (const part of cleaned.split(/\s*\/\s*/)) {
    const match = part.trim().match(/^(\d+)\s+(.+)$/);
    if (!match) continue;

    const [, value, labelRaw] = match;
    const key = STAT_ALIASES[labelRaw.trim().toLowerCase()];
    if (key) out[key] = value;
  }

  return out;
}

export function parseStatPointsLine(line: string): Partial<Record<StatKey, number>> {
  const out: Partial<Record<StatKey, number>> = {};
  const cleaned = line.replace(/^EVs:\s*/i, "").trim();

  for (const part of cleaned.split(/\s*\/\s*/)) {
    const match = part.trim().match(/^(\d+)\s+(.+)$/);
    if (!match) continue;

    const [, valueRaw, labelRaw] = match;
    const key = STAT_ALIASES[labelRaw.trim().toLowerCase()];
    if (key) out[key] = Number.parseInt(valueRaw, 10);
  }

  return out;
}

export function parsePokepaste(text: string): PokemonSet[] {
  const blocks = text
    .trim()
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  const team: PokemonSet[] = [];

  for (const block of blocks) {
    const lines = block
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) continue;

    const mon: PokemonSet = {
      pokemon: "",
      item: "",
      ability: "",
      level: String(CHAMPIONS_LEVEL),
      nature: "Serious",
      hasNature: false,
      hasStatPoints: false,
      statPoints: {},
      moves: [],
      stats: {},
    };

    const first = lines[0];
    if (first.includes(" @ ")) {
      const [left, item] = first.split(" @ ", 2);
      mon.pokemon = cleanName(left);
      mon.item = item.trim();
    } else {
      mon.pokemon = cleanName(first);
    }

    for (const line of lines.slice(1)) {
      const lower = line.toLowerCase();

      if (lower.startsWith("ability:")) {
        mon.ability = line.split(":", 2)[1].trim();
      } else if (lower.startsWith("level:")) {
        mon.level = line.split(":", 2)[1].trim();
      } else if (lower.startsWith("evs:")) {
        mon.hasStatPoints = true;
        mon.statPoints = { ...mon.statPoints, ...parseStatPointsLine(line) };
      } else if (/\s+nature$/i.test(line)) {
        mon.nature = line.replace(/\s+Nature$/i, "").trim();
        mon.hasNature = true;
      } else if (lower.startsWith("stat alignment:")) {
        mon.nature = line.split(":", 2)[1].trim();
        mon.hasNature = true;
      } else if (lower.startsWith("stats:")) {
        mon.stats = { ...mon.stats, ...parseStatsLine(line) };
      } else if (line.startsWith("-")) {
        const move = line.slice(1).trim();
        if (move) mon.moves.push(move);
      }
    }

    team.push(mon);
  }

  return team;
}

export function buildPokedexFromDex(): Pokedex {
  const pokedex: Pokedex = {};

  for (const species of Dex.species.all()) {
    if (!species.exists) continue;

    pokedex[toId(species.name)] = {
      name: species.name,
      baseSpecies: species.baseSpecies,
      requiredItem: species.requiredItem ?? species.requiredItems?.[0],
      isMega: species.isMega,
      baseStats: {
        hp: species.baseStats.hp,
        atk: species.baseStats.atk,
        def: species.baseStats.def,
        spa: species.baseStats.spa,
        spd: species.baseStats.spd,
        spe: species.baseStats.spe,
      },
    };
  }

  return pokedex;
}

function getSpeciesData(mon: PokemonSet, pokedex: Pokedex): PokedexSpecies {
  const speciesId = toId(mon.pokemon);
  const species = pokedex[speciesId];

  if (!species) {
    throw new Error(`Could not find base stats for ${JSON.stringify(mon.pokemon)} in the Pokemon data.`);
  }

  if (species.isMega) {
    const baseName = species.baseSpecies ?? species.name?.replace(/-Mega.*$/, "") ?? mon.pokemon;
    const megaItem = species.requiredItem ?? "the appropriate Mega Stone";
    throw new Error(
      `${species.name ?? mon.pokemon} cannot be added as a Mega-evolved Pokemon. ` +
        `Use ${baseName} holding ${megaItem} instead.`
    );
  }

  return species;
}

function validateStatPoints(mon: PokemonSet): void {
  const total = Object.values(mon.statPoints).reduce((sum, value) => sum + (value ?? 0), 0);

  if (total > CHAMPIONS_MAX_TOTAL_STAT_POINTS) {
    throw new Error(
      `${mon.pokemon} has ${total} Stat Points; Pokemon Champions allows ` +
        `${CHAMPIONS_MAX_TOTAL_STAT_POINTS} total.`
    );
  }

  for (const [stat, value] of Object.entries(mon.statPoints) as [StatKey, number][]) {
    if (value > CHAMPIONS_MAX_STAT_POINTS) {
      throw new Error(
        `${mon.pokemon} has ${value} ${stat} Stat Points; Pokemon Champions allows ` +
          `${CHAMPIONS_MAX_STAT_POINTS} per stat.`
      );
    }
  }
}

export function validatePokemonTeam(pokepasteText: string, pokedex: Pokedex): TeamSheetValidationResult {
  const issues: ValidationIssue[] = [];
  const team = parsePokepaste(pokepasteText);

  if (!pokepasteText.trim()) {
    issues.push({
      field: "pokepaste",
      message: "Paste a six-Pokemon team in Pokepaste or Pokemon Showdown format.",
    });
  }

  if (team.length !== 6) {
    issues.push({
      field: "pokepaste",
      message: `The teamsheet must contain exactly 6 Pokemon; ${team.length} ${team.length === 1 ? "set was" : "sets were"} found.`,
    });
  }

  team.forEach((mon, index) => {
    const field = `pokemon-${index + 1}`;
    const label = mon.pokemon || `Pokemon ${index + 1}`;

    if (!mon.pokemon) {
      issues.push({ field, message: `Pokemon ${index + 1} is missing a species name.` });
    } else {
      try {
        getSpeciesData(mon, pokedex);
      } catch (error) {
        issues.push({ field, message: error instanceof Error ? error.message : `${label} is not recognized.` });
      }
    }

    if (!mon.item) {
      issues.push({ field, message: `${label} is missing an item on the first line.` });
    }

    if (!mon.ability) {
      issues.push({ field, message: `${label} is missing an Ability line.` });
    }

    if (mon.hasNature && !NATURE_MODIFIERS[mon.nature.trim().toLowerCase()]) {
      issues.push({ field, message: `${label} has an unrecognized nature: ${mon.nature}.` });
    }

    const level = Number.parseInt(mon.level, 10);
    if (!Number.isFinite(level)) {
      issues.push({ field, message: `${label} has an invalid level: ${mon.level}.` });
    } else if (level !== CHAMPIONS_LEVEL) {
      issues.push({
        field,
        message: `${label} is level ${level}; Pokemon Champions teamsheets are generated at level ${CHAMPIONS_LEVEL}.`,
      });
    }

    if (mon.hasStatPoints && Object.keys(mon.statPoints).length === 0) {
      issues.push({ field, message: `${label} has an EVs line, but no valid stat points were parsed.` });
    } else if (mon.hasStatPoints) {
      try {
        validateStatPoints(mon);
      } catch (error) {
        issues.push({ field, message: error instanceof Error ? error.message : `${label} has invalid stat points.` });
      }
    }

    if (mon.moves.length !== 4) {
      issues.push({
        field,
        message: `${label} must have exactly 4 moves; ${mon.moves.length} ${mon.moves.length === 1 ? "move was" : "moves were"} found.`,
      });
    }
  });

  return {
    team,
    issues,
    isValid: issues.length === 0,
  };
}

function natureMultiplier(nature: string, stat: StatKey): number {
  const [boosted, lowered] = NATURE_MODIFIERS[nature.trim().toLowerCase()] ?? [null, null];
  if (stat === boosted) return 1.1;
  if (stat === lowered) return 0.9;
  return 1.0;
}

function calculateStat(base: number, level: number, stat: StatKey, statPoints: number, nature: string): number {
  if (stat === "HP") {
    return Math.floor(((2 * base + CHAMPIONS_IV) * level) / 100) + level + 10 + statPoints;
  }

  const raw = Math.floor(((2 * base + CHAMPIONS_IV) * level) / 100) + 5 + statPoints;
  return Math.trunc(raw * natureMultiplier(nature, stat));
}

export function applyCalculatedStats(team: PokemonSet[], pokedex: Pokedex): PokemonSet[] {
  return team.map((mon) => {
    const species = getSpeciesData(mon, pokedex);
    validateStatPoints(mon);

    const level = Number.parseInt(mon.level, 10);
    if (!Number.isFinite(level)) {
      throw new Error(`${mon.pokemon} has an invalid level: ${JSON.stringify(mon.level)}.`);
    }

    const stats: Partial<Record<StatKey, string>> = {};
    for (const stat of STAT_KEYS) {
      stats[stat] = String(
        calculateStat(
          species.baseStats[DEX_STAT_KEYS[stat]],
          level,
          stat,
          mon.statPoints[stat] ?? 0,
          mon.nature
        )
      );
    }

    return { ...mon, stats };
  });
}

function fitText(
  page: PDFPage,
  font: PDFFont,
  text: string | number | undefined,
  x: number,
  y: number,
  maxWidth: number,
  size = 8.5
): void {
  const value = String(text ?? "");
  if (!value) return;

  let currentSize = size;
  while (currentSize > 5.5 && font.widthOfTextAtSize(value, currentSize) > maxWidth) {
    currentSize -= 0.4;
  }

  page.drawText(value, {
    x,
    y,
    size: currentSize,
    font,
    color: rgb(0, 0, 0),
  });
}

function checkbox(page: PDFPage, boldFont: PDFFont, x: number, y: number, mark: boolean): void {
  if (!mark) return;
  page.drawText("X", {
    x,
    y,
    size: 11,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
}

function drawMetadata(page: PDFPage, font: PDFFont, boldFont: PDFFont, metadata: TeamSheetMetadata, staff: boolean): void {
  const ageDivision = (metadata.ageDivision ?? "Masters").toLowerCase();

  fitText(page, font, metadata.playerName, 120, 681, 145, 9);
  checkbox(page, boldFont, 447, 670, ageDivision === "juniors");
  checkbox(page, boldFont, 513, 670, ageDivision === "seniors");
  checkbox(page, boldFont, 565, 670, ageDivision === "masters");
  fitText(page, font, metadata.trainerName, 155, staff ? 659 : 655, 145, 9);

  if (staff) {
    fitText(page, font, metadata.playerId, 410, 655, 95, 9);
    fitText(page, font, metadata.battleTeam, 170, 643, 125, 9);
    fitText(page, font, metadata.dob, 410, 639, 95, 9);
    fitText(page, font, metadata.switchProfile, 145, 625, 160, 9);
  } else {
    fitText(page, font, metadata.battleTeam, 170, 639, 145, 9);
    fitText(page, font, metadata.switchProfile, 145, 621, 160, 9);
  }
}

function drawMonStaff(page: PDFPage, font: PDFFont, mon: PokemonSet, x: number, y: number): void {
  const valueX = x + 72;
  const statX = x + 238;

  const rows: Array<[value: string, statValue: string]> = [
    [mon.pokemon, mon.level],
    [mon.ability, mon.stats.HP ?? ""],
    [mon.item, mon.stats.Atk ?? ""],
    [mon.moves[0] ?? "", mon.stats.Def ?? ""],
    [mon.moves[1] ?? "", mon.stats.SpA ?? ""],
    [mon.moves[2] ?? "", mon.stats.SpD ?? ""],
    [mon.moves[3] ?? "", mon.stats.Spe ?? ""],
  ];

  rows.forEach(([value, statValue], index) => {
    const yy = y - index * 25.2;
    if (index === 0) {
      fitText(page, font, value, valueX, yy, 125, 8.5);
      if (statValue && statValue !== "50") fitText(page, font, statValue, statX, yy, 22, 8.5);
    } else {
      fitText(page, font, value, valueX, yy, 120, 8.0);
      fitText(page, font, statValue, statX, yy, 22, 8.0);
    }
  });
}

function drawMonOpponent(page: PDFPage, font: PDFFont, mon: PokemonSet, x: number, y: number): void {
  const values = [mon.pokemon, mon.ability, mon.item, mon.moves[0] ?? "", mon.moves[1] ?? "", mon.moves[2] ?? "", mon.moves[3] ?? ""];
  const offsets = [0, 25.2, 50.4, 75.6, 100.8, 126.0, 151.2];

  values.forEach((value, index) => {
    fitText(page, font, value, x + 72, y - offsets[index], 142, 8.5);
  });
}

function drawTeamPage(page: PDFPage, font: PDFFont, boldFont: PDFFont, team: PokemonSet[], metadata: TeamSheetMetadata, staff: boolean): void {
  drawMetadata(page, font, boldFont, metadata, staff);

  if (staff) {
    const xs = [43, 323];
    const ys = [572, 390, 208];
    team.forEach((mon, index) => drawMonStaff(page, font, mon, xs[index % 2], ys[Math.floor(index / 2)]));
  } else {
    const xs = [43, 323];
    const ys = [592, 407, 222];
    team.forEach((mon, index) => drawMonOpponent(page, font, mon, xs[index % 2], ys[Math.floor(index / 2)]));
  }
}

export async function generateTeamSheetPdf(params: {
  pokepasteText: string;
  templateBytes: ArrayBuffer | Uint8Array;
  pokedex: Pokedex;
  metadata?: TeamSheetMetadata;
}): Promise<Uint8Array> {
  const validation = validatePokemonTeam(params.pokepasteText, params.pokedex);
  if (!validation.isValid) {
    throw new Error(validation.issues.map((issue) => issue.message).join("\n"));
  }

  const team = applyCalculatedStats(validation.team, params.pokedex);
  const pdfDoc = await PDFDocument.load(params.templateBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();

  pages.forEach((page, pageIndex) => {
    drawTeamPage(page, font, boldFont, team, params.metadata ?? {}, pageIndex === 0);
  });

  return pdfDoc.save();
}

export function createPdfBlob(pdfBytes: Uint8Array): Blob {
  const buffer = new ArrayBuffer(pdfBytes.byteLength);
  new Uint8Array(buffer).set(pdfBytes);
  return new Blob([buffer], { type: "application/pdf" });
}

export function downloadPdf(pdfBytes: Uint8Array, filename = "team-sheet.pdf"): void {
  const blob = createPdfBlob(pdfBytes);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
