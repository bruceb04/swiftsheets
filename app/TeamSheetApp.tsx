"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AgeDivision,
  TeamSheetMetadata,
  ValidationIssue,
  buildPokedexFromDex,
  createPdfBlob,
  downloadPdf,
  generateTeamSheetPdf,
  validatePokemonTeam,
} from "./pokepastePdf";

type FormState = Required<TeamSheetMetadata> & {
  pokepaste: string;
};

const POKEDEX = buildPokedexFromDex();

const INITIAL_FORM: FormState = {
  playerName: "",
  ageDivision: "Masters",
  trainerName: "",
  playerId: "",
  battleTeam: "",
  dob: "",
  switchProfile: "",
  pokepaste: "",
};

const FIELD_LABELS: Array<{
  name: keyof Omit<FormState, "pokepaste" | "ageDivision">;
  label: string;
  placeholder: string;
  type?: string;
}> = [
  { name: "playerName", label: "Player name", placeholder: "Alex Rivera" },
  { name: "trainerName", label: "Trainer name", placeholder: "Swift" },
  { name: "playerId", label: "Player ID", placeholder: "1234567" },
  { name: "battleTeam", label: "Battle team", placeholder: "Team 1" },
  { name: "dob", label: "Date of birth", placeholder: "2001-04-15", type: "date" },
  { name: "switchProfile", label: "Switch profile", placeholder: "SwiftSheets" },
];

function metadataIssues(form: FormState): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  FIELD_LABELS.forEach((field) => {
    if (!form[field.name].trim()) {
      issues.push({
        field: field.name,
        message: `${field.label} is required.`,
      });
    }
  });

  if (!form.ageDivision) {
    issues.push({
      field: "ageDivision",
      message: "Age division is required.",
    });
  }

  return issues;
}

function issueForField(issues: ValidationIssue[], field: string): string | undefined {
  return issues.find((issue) => issue.field === field)?.message;
}

function sanitizeFilename(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function TeamSheetApp() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [status, setStatus] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const validation = useMemo(() => validatePokemonTeam(form.pokepaste, POKEDEX), [form.pokepaste]);
  const allIssues = useMemo(() => [...metadataIssues(form), ...validation.issues], [form, validation.issues]);
  const isValid = allIssues.length === 0;
  const teamCount = validation.team.length;

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function clearGeneratedPdf() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPdfBytes(null);
    setStatus("");
  }

  function updateField(name: keyof FormState, value: string) {
    clearGeneratedPdf();
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function buildPdf(): Promise<Uint8Array> {
    if (!isValid) {
      throw new Error("Fix the highlighted fields before generating the teamsheet.");
    }

    const response = await fetch("/blanksheet.pdf");
    if (!response.ok) {
      throw new Error("Could not load blanksheet.pdf from the public folder.");
    }

    return generateTeamSheetPdf({
      pokepasteText: form.pokepaste,
      templateBytes: await response.arrayBuffer(),
      pokedex: POKEDEX,
      metadata: {
        playerName: form.playerName.trim(),
        ageDivision: form.ageDivision,
        trainerName: form.trainerName.trim(),
        playerId: form.playerId.trim(),
        battleTeam: form.battleTeam.trim(),
        dob: form.dob.trim(),
        switchProfile: form.switchProfile.trim(),
      },
    });
  }

  async function handlePreview() {
    setIsGenerating(true);
    setStatus("Generating preview...");

    try {
      const bytes = await buildPdf();
      const blob = createPdfBlob(bytes);
      const url = URL.createObjectURL(blob);

      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPdfBytes(bytes);
      setPreviewUrl(url);
      setStatus("Preview ready.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not generate the PDF.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleDownload() {
    setIsGenerating(true);
    setStatus(pdfBytes ? "Preparing download..." : "Generating download...");

    try {
      const bytes = pdfBytes ?? (await buildPdf());
      const filenameBase = sanitizeFilename(form.playerName) || "team";
      downloadPdf(bytes, `${filenameBase}-champions-teamsheet.pdf`);
      setStatus("Download started.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not download the PDF.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7f2] text-zinc-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-3 border-b border-zinc-300 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-emerald-700">SwiftSheets</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
              Pokemon Champions teamsheet builder
            </h1>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="border border-zinc-300 bg-white px-4 py-3">
              <p className="font-semibold">{teamCount}/6</p>
              <p className="text-zinc-600">Pokemon</p>
            </div>
            <div className="border border-zinc-300 bg-white px-4 py-3">
              <p className="font-semibold">31</p>
              <p className="text-zinc-600">IVs</p>
            </div>
            <div className="border border-zinc-300 bg-white px-4 py-3">
              <p className="font-semibold">50</p>
              <p className="text-zinc-600">Level</p>
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <section className="flex flex-col gap-5">
            <div className="bg-white p-4 shadow-sm ring-1 ring-zinc-200 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Player information</h2>
                <span className="text-sm text-zinc-500">All fields required</span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {FIELD_LABELS.map((field) => {
                  const error = issueForField(allIssues, field.name);

                  return (
                    <label key={field.name} className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium">{field.label}</span>
                      <input
                        className={`h-11 border bg-white px-3 text-sm outline-none transition focus:border-emerald-700 ${
                          error ? "border-red-500" : "border-zinc-300"
                        }`}
                        type={field.type ?? "text"}
                        value={form[field.name]}
                        placeholder={field.placeholder}
                        aria-invalid={Boolean(error)}
                        onChange={(event) => updateField(field.name, event.target.value)}
                      />
                      {error ? <span className="text-xs text-red-700">{error}</span> : null}
                    </label>
                  );
                })}

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">Age division</span>
                  <select
                    className="h-11 border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-700"
                    value={form.ageDivision}
                    onChange={(event) => updateField("ageDivision", event.target.value as AgeDivision)}
                  >
                    <option value="Juniors">Juniors</option>
                    <option value="Seniors">Seniors</option>
                    <option value="Masters">Masters</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="bg-white p-4 shadow-sm ring-1 ring-zinc-200 sm:p-5">
              <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <h2 className="text-lg font-semibold">Pokepaste</h2>
                <p className="text-sm text-zinc-500">Use EVs for Champions stat points.</p>
              </div>

              <textarea
                className={`min-h-[430px] w-full resize-y border bg-white p-3 font-mono text-sm leading-6 outline-none transition focus:border-emerald-700 ${
                  issueForField(allIssues, "pokepaste") ? "border-red-500" : "border-zinc-300"
                }`}
                value={form.pokepaste}
                placeholder={
                  "Pikachu @ Light Ball\nAbility: Static\nEVs: 32 Atk / 32 Spe\nJolly Nature\n- Fake Out\n- Volt Tackle\n- Protect\n- Feint\n\nRepeat for exactly 6 Pokemon..."
                }
                aria-invalid={Boolean(issueForField(allIssues, "pokepaste"))}
                onChange={(event) => updateField("pokepaste", event.target.value)}
              />
            </div>
          </section>

          <aside className="flex flex-col gap-5 lg:sticky lg:top-5 lg:self-start">
            <div className="bg-white p-4 shadow-sm ring-1 ring-zinc-200 sm:p-5">
              <h2 className="text-lg font-semibold">Validation</h2>
              {allIssues.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {allIssues.map((issue, index) => (
                    <p key={`${issue.field}-${index}`} className="border-l-4 border-red-500 bg-red-50 px-3 py-2 text-sm text-red-800">
                      {issue.message}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="mt-4 border-l-4 border-emerald-600 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  Ready to generate a marked teamsheet.
                </p>
              )}

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <button
                  className="h-11 bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-600"
                  type="button"
                  disabled={!isValid || isGenerating}
                  onClick={handlePreview}
                >
                  {isGenerating ? "Working..." : "Preview PDF"}
                </button>
                <button
                  className="h-11 border border-zinc-900 bg-white px-4 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-950 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-300 disabled:text-zinc-500 disabled:hover:bg-white"
                  type="button"
                  disabled={!isValid || isGenerating}
                  onClick={handleDownload}
                >
                  Download PDF
                </button>
              </div>

              {status ? <p className="mt-4 whitespace-pre-line text-sm text-zinc-700">{status}</p> : null}
            </div>

            <div className="min-h-[520px] bg-white p-3 shadow-sm ring-1 ring-zinc-200">
              {previewUrl ? (
                <object className="h-[70vh] min-h-[500px] w-full" data={previewUrl} type="application/pdf">
                  <a className="text-sm font-semibold text-emerald-700" href={previewUrl} target="_blank" rel="noreferrer">
                    Open PDF preview
                  </a>
                </object>
              ) : (
                <div className="flex h-[500px] items-center justify-center border border-dashed border-zinc-300 px-6 text-center text-sm text-zinc-500">
                  A marked PDF preview will appear here after the form passes validation.
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
