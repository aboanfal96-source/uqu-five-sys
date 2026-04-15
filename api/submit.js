export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const BIN_ID  = process.env.JSONBIN_BIN_ID;
  const BIN_KEY = process.env.JSONBIN_API_KEY;
  if (!BIN_ID || !BIN_KEY) return res.status(500).json({ error: 'Storage not configured' });

  const body = req.body;
  if (!body.projectName || !body.requesterName)
    return res.status(400).json({ error: 'بيانات ناقصة' });

  try {
    const readRes = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
      headers: { 'X-Master-Key': BIN_KEY }
    });
    const readData = await readRes.json();
    const requests = readData.record?.requests || [];

    const id = 'REQ-' + Date.now();
    requests.unshift({ id, status: 'pending', submittedAt: new Date().toISOString(), ...body });

    await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Master-Key': BIN_KEY },
      body: JSON.stringify({ requests: requests.slice(0, 100) })
    });

    return res.status(200).json({ success: true, id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
