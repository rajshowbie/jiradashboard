export default async function handler(req, res) {
  // Disable CORS from browser (proxy handles it server-side)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { url, email, token, path } = req.body;

  if (!url || !email || !token || !path) {
    return res.status(400).json({ error: 'Missing url, email, token, or path' });
  }

  try {
    const jiraUrl = `${url}/rest/api/3${path}`;
    const auth = Buffer.from(`${email}:${token}`).toString('base64');

    const response = await fetch(jiraUrl, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({
        error: `Jira API ${response.status}`,
        detail: text.slice(0, 200),
      });
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
