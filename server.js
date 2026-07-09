const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;

async function jiraGet(url, email, token, pathname) {
  const auth = Buffer.from(`${email}:${token}`).toString('base64');
  const resp = await fetch(`${url}/rest/api/2${pathname}`, {
    headers: {
      'Authorization': `Basic ${auth}`,
      'Accept': 'application/json',
    },
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Jira API ${resp.status}: ${txt.slice(0, 200)}`);
  }
  return resp.json();
}

function processIssue(issue, config) {
  const STUCK_DAYS = config.STUCK_DAYS || 5;
  const REWORK_COUNT = config.REWORK_COUNT || 2;
  const CRITICAL_DAYS = config.CRITICAL_DAYS || 3;

  const changelog = issue.changelog?.histories || [];
  const transitions = [];
  const statusChanges = changelog
    .flatMap(h => h.items
      .filter(i => i.field === 'status')
      .map(i => ({ date: new Date(h.created), from: i.fromString, to: i.toString }))
    )
    .sort((a,b) => a.date - b.date);

  const created = new Date(issue.fields.created);
  const now = new Date();

  const firstState = statusChanges.length > 0 ? statusChanges[0].from : issue.fields.status.name;
  transitions.push({ state: firstState, start: created, end: statusChanges.length > 0 ? statusChanges[0].date : now });

  for (let i = 0; i < statusChanges.length; i++) {
    const sc = statusChanges[i];
    const end = i + 1 < statusChanges.length ? statusChanges[i+1].date : now;
    transitions.push({ state: sc.to, start: sc.date, end });
  }

  transitions.forEach(t => {
    t.days = Math.max(0, (t.end - t.start) / 86400000);
  });

  let cycleStart = transitions.find(t => ['in progress', 'in development', 'dev', 'development'].includes(t.state.toLowerCase()));
  const closedT = transitions.slice().reverse().find(t => ['done', 'closed', 'resolved'].includes(t.state.toLowerCase()));
  const cycleEnd = closedT ? closedT.end : now;
  const cycleDays = cycleStart ? (cycleEnd - cycleStart.start) / 86400000 : null;

  let reworkCount = 0;
  transitions.forEach(t => {
    if (t.state.toLowerCase().includes('rework') || t.state.toLowerCase().includes('reopened')) reworkCount++;
  });

  let hasRegression = false;
  for (let i = 1; i < transitions.length; i++) {
    const prev = transitions[i-1].state.toLowerCase();
    const curr = transitions[i].state.toLowerCase();
    if ((prev.includes('demo') || prev.includes('ready')) && !curr.includes('rework') && !['done','closed','resolved'].includes(curr)) {
      hasRegression = true;
    }
  }

  const currentState = issue.fields.status.name;
  const currentTransition = transitions[transitions.length - 1];
  const daysInCurrent = currentTransition ? currentTransition.days : 0;
  const isStuck = daysInCurrent > STUCK_DAYS && !['done','closed','resolved'].includes(currentState.toLowerCase());

  const priority = issue.fields.priority?.name || 'Medium';
  const isCritical = ['Highest','Critical','Blocker','High'].includes(priority);
  const isCriticalDelayed = isCritical && cycleDays !== null && cycleDays > CRITICAL_DAYS && !['done','closed','resolved'].includes(currentState.toLowerCase());

  const getCommentText = (body) => {
    if (typeof body === 'string') return body;
    if (body?.content?.[0]?.content?.[0]?.text) return body.content[0].content[0].text;
    return '';
  };

  const comments = (issue.fields.comment?.comments || [])
    .filter(c => {
      const text = getCommentText(c.body).toLowerCase();
      return text.includes('block') || text.includes('decision') || text.includes('decided') ||
             text.includes('review') || text.includes('concern') || text.includes('risk');
    })
    .map(c => ({
      author: c.author?.displayName || 'Unknown',
      date: c.created,
      body: getCommentText(c.body).slice(0, 300),
    }));

  return {
    key: issue.key,
    summary: issue.fields.summary,
    status: currentState,
    priority,
    created: issue.fields.created,
    cycleTime: cycleDays,
    transitions,
    reworkCount,
    hasRegression,
    isStuck,
    daysInCurrent: Math.round(daysInCurrent * 10) / 10,
    isCriticalDelayed,
    comments,
  };
}

app.post('/api/fetch-data', async (req, res) => {
  try {
    const { jiraUrl, jiraEmail, jiraToken, jiraEpic, stuckDays, reworkCount, criticalDays } = req.body;

    if (!jiraUrl || !jiraEmail || !jiraToken || !jiraEpic) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log(`🔄 Fetching epic ${jiraEpic}…`);
    const epicIssue = await jiraGet(jiraUrl, jiraEmail, jiraToken, `/issue/${jiraEpic}?fields=key,id,summary`);
    const epicId = epicIssue.id;
    console.log(`✓ Epic: ${epicIssue.key}`);

    console.log('🔄 Fetching child issues…');
    const jql = `parent = ${epicId}`;
    const auth = Buffer.from(`${jiraEmail}:${jiraToken}`).toString('base64');
    const allIssues = [];
    let nextPageToken = undefined;

    while (true) {
      const body = {
        jql,
        maxResults: 50,
        expand: 'changelog',
        fields: ['summary', 'status', 'priority', 'assignee', 'created', 'updated', 'resolutiondate', 'comment', 'parent'],
      };
      if (nextPageToken) body.nextPageToken = nextPageToken;

      const resp = await fetch(`${jiraUrl}/rest/api/3/search/jql`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Jira API ${resp.status}: ${txt.slice(0, 200)}`);
      }

      const data = await resp.json();
      allIssues.push(...(data.issues || []));
      console.log(`  ${allIssues.length} issues fetched…`);

      if (!data.nextPageToken) break;
      nextPageToken = data.nextPageToken;
    }

    console.log(`✓ Fetched ${allIssues.length} issues`);

    const config = {
      STUCK_DAYS: parseInt(stuckDays) || 5,
      REWORK_COUNT: parseInt(reworkCount) || 2,
      CRITICAL_DAYS: parseInt(criticalDays) || 3,
    };

    console.log('🔄 Processing data…');
    const issues = allIssues.map(issue => processIssue(issue, config));

    const output = {
      epic: jiraEpic,
      timestamp: new Date().toISOString(),
      issues,
      config,
    };

    console.log(`✅ Fetched and processed ${issues.length} issues`);
    res.json(output);
  } catch (err) {
    console.error('❌ Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Dashboard running at http://localhost:${PORT}`);
  console.log(`📊 Open http://localhost:${PORT} in your browser`);
});
