# Jira Flow Timeline Dashboard

A self-hosted, single-page app for visualizing Jira epic flow — state transitions, cycle time, rework patterns, and anomaly detection.

## Deploy to Vercel

```bash
npx vercel
```

Or connect this repo in [vercel.com](https://vercel.com) → New Project → import from GitHub. No build config needed — Vercel detects it as a static site automatically.

## Run locally

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

Or just double-click `index.html` in Finder.

## Usage

1. Open the app and click **Configure**
2. Enter your Jira base URL (e.g. `https://yourorg.atlassian.net`)
3. Enter your email and an [API token](https://id.atlassian.net/manage-profile/security/api-tokens)
4. Enter the Epic issue key (e.g. `IOS-42`)
5. Click **Connect & Fetch**

Configuration is saved in `localStorage` — no server, no database.

## Features

- **Timeline view** — Gantt-style bars showing each state segment per issue with hover tooltips
- **Flow metrics** — total issues, closed %, avg cycle time, rework rate, stuck count
- **Anomaly detection** — stuck issues, excessive rework, regressions, critical delays
- **Comment extraction** — filters Jira comments for blockers, decisions, and review notes
- **CSV export** — full timeline data with transition chains

## Tech

Vanilla HTML/CSS/JS. No build step, no dependencies, no framework.
