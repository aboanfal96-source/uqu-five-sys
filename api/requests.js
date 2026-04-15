export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Admin key check
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'غير مصرح' });
  }

  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;

  try {
    // Get list of IDs
    const listRes = await fetch(`${KV_URL}/get/requests_list`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
    const listData = await listRes.json();
    const list = listData.result ? JSON.parse(listData.result) : [];

    // Get each request
    const requests = await Promise.all(list.slice(0, 50).map(async (id) => {
      const r = await fetch(`${KV_URL}/get/${id}`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` }
      });
      const d = await r.json();
      return d.result ? JSON.parse(d.result) : null;
    }));

    return res.status(200).json({ requests: requests.filter(Boolean) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
