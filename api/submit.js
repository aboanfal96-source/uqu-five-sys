export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;
  if (!KV_URL || !KV_TOKEN) return res.status(500).json({ error: 'Storage not configured' });

  const body = req.body;
  if (!body.projectName || !body.requesterName) {
    return res.status(400).json({ error: 'بيانات ناقصة' });
  }

  const id = 'REQ-' + Date.now();
  const request = {
    id,
    status: 'pending',
    submittedAt: new Date().toISOString(),
    ...body
  };

  // Save to KV
  await fetch(`${KV_URL}/set/${id}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });

  // Add to list of all requests
  const listRes = await fetch(`${KV_URL}/get/requests_list`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` }
  });
  const listData = await listRes.json();
  const list = listData.result ? JSON.parse(listData.result) : [];
  list.unshift(id);

  await fetch(`${KV_URL}/set/requests_list`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(JSON.stringify(list))
  });

  return res.status(200).json({ success: true, id });
}
