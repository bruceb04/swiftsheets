# SwiftSheets

SwiftSheets is a browser-based teamsheet builder for Pokemon Champions events. It converts Pokepaste or Pokemon Showdown-style team text into a completed Champions teamsheet PDF, including player information, Pokemon details, moves, held items, abilities, calculated level 50 stats, and event-ready staff and opponent views.

The app is built as a static Next.js application, so it can be hosted on GitHub Pages without a backend. PDF generation runs in the browser with `pdf-lib`, while Pokemon species data and base stats come from `@pkmn/dex`.

## Features

- Parse teams from standard Pokepaste / Pokemon Showdown text.
- Validate required player metadata before generating a sheet.
- Validate Champions team constraints, including:
  - 4-6 Pokemon per team
  - Level 50 Pokemon
  - 1-4 moves per Pokemon
  - Recognized Pokemon species
  - Recognized natures
  - Champions stat point limits
- Treat `EVs` lines as Pokemon Champions stat points.
- Calculate level 50 stats from species base stats, 31 IVs, stat points, and nature modifiers.
- Generate a marked PDF from the bundled `blanksheet.pdf` template.
- Preview the generated PDF in the app before downloading.
- Export as a static site for GitHub Pages.

## Tech Stack

- [Next.js](https://nextjs.org/) 16
- [React](https://react.dev/) 19
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/) 4
- [`pdf-lib`](https://pdf-lib.js.org/) for PDF editing
- [`@pkmn/dex`](https://github.com/pkmn/ps/tree/main/dex) for Pokemon data

## Getting Started

### Prerequisites

- Node.js 22 is recommended for parity with the GitHub Pages workflow.
- npm, which is included with Node.js.

### Installation

```bash
npm install
```

### Local Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. Enter the required player information.
2. Paste a 4-6 Pokemon team in Pokepaste or Pokemon Showdown format.
3. Use `EVs` lines for Champions stat points, for example:

```text
Pikachu @ Light Ball
Ability: Static
Level: 50
EVs: 32 Atk / 32 Spe
Jolly Nature
- Fake Out
- Volt Tackle
- Protect
- Feint
```

4. Resolve any validation messages shown in the sidebar.
5. Select `Preview PDF` to inspect the completed teamsheet.
6. Select `Download PDF` to save the generated file.

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Starts the local Next.js development server. |
| `npm run build` | Builds the static export into the `out` directory. |
| `npm run lint` | Runs ESLint. |
| `npm run start` | Runs the Next.js production start command. For static hosting previews, serve the generated `out` directory instead. |

## Project Structure

```text
app/
  TeamSheetApp.tsx   Main client-side form, validation UI, preview, and download flow.
  pokepastePdf.ts    Pokepaste parsing, team validation, stat calculation, and PDF drawing.
  page.tsx           App route entry point.
public/
  blanksheet.pdf     PDF template used by the generator.
.github/workflows/
  deploy.yml         GitHub Pages deployment workflow.
next.config.ts       Static export and GitHub Pages base path configuration.
```

## Static Export

SwiftSheets is configured with `output: "export"` in `next.config.ts`. Running the build command produces a static site in `out`.

```bash
npm run build
```

The app automatically accounts for GitHub Pages project paths by setting `NEXT_PUBLIC_BASE_PATH` during GitHub Actions builds. Project Pages repositories are served from `/<repository-name>`, while user or organization Pages repositories ending in `.github.io` are served from the domain root.

## Deployment

This repository includes a GitHub Actions workflow for GitHub Pages.

1. Push the repository to the `main` branch.
2. In GitHub, open **Settings > Pages**.
3. Set **Build and deployment > Source** to **GitHub Actions**.
4. Run the `Deploy to GitHub Pages` workflow, or push to `main`.

The workflow installs dependencies with `npm ci`, builds the static export, uploads the `out` directory, and publishes it to GitHub Pages.

## Notes

- PDF generation is client-side; the app does not require a custom API server.
- The bundled `blanksheet.pdf` template must remain available in `public/` for local and deployed builds.
- Mega-evolved Pokemon should be entered as their base species holding the appropriate Mega Stone.

