# Jira Flow Timeline Dashboard

A self-hosted Jira flow timeline dashboard where you can input any epic and instantly visualize issue state transitions, cycle time, and anomalies.

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Start the server
```bash
npm start
```

Then open **http://localhost:3000** in your browser.

### 3. Enter your Jira details
The settings form will open automatically. Fill in:
- **Jira Base URL**: e.g., `https://showbie.atlassian.net`
- **Email**: Your Jira email
- **API Token**: Generate at [id.atlassian.net](https://id.atlassian.net/manage-profile/security/api-tokens)
  - Select "Create API token with scopes"
  - Choose `read:jira-work` scope
- **Epic Issue Key**: e.g., `CT-127`
- **Thresholds**: Customize stuck/rework/delay detection

### 4. Fetch and visualize
Click "Fetch Data" — the dashboard will populate with your epic's issues, transitions, and metrics.

## Features

- **Timeline view** — Gantt-style visualization of issue state progressions
- **Flow metrics** — cycle time, rework rate, stuck issues, closed rate
- **Anomaly detection** — stuck issues, excessive rework, regressions, critical delays
- **Dynamic epic input** — change epic key anytime without code changes
- **Saved settings** — credentials cached locally (localStorage) for next session
- **No external deployment** — entirely self-hosted and self-contained

## How it works

1. **Server** (Node.js/Express): Fetches data from Jira API securely (no CORS issues)
2. **Frontend** (HTML/JS): Displays timeline and metrics from server response
3. **Settings**: Stored in browser localStorage — no database needed

## Troubleshooting

- **"Missing required environment variables"**: Fill in all fields in the settings form
- **"Jira API 410"**: Ensure your API token has `read:jira-work` scope
- **"Issue does not exist"**: Check that you have permission to access that epic
- **Can't find your epic?**: Make sure the epic key is correct (e.g., `CT-127`, not `ct-127`)

## Tech stack

- **Backend**: Node.js + Express
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Auth**: Jira API Token (Basic Auth)
- **Storage**: localStorage (credentials only)

## License

MIT
