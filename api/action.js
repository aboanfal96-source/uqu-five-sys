export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) return res.status(401).json({ error: 'غير مصرح' });

  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;
  const { id, action, notes } = req.body;

  // Get the request
  const r = await fetch(`${KV_URL}/get/${id}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` }
  });
  const d = await r.json();
  if (!d.result) return res.status(404).json({ error: 'الطلب غير موجود' });

  const request = JSON.parse(d.result);
  request.status = action; // 'approved' or 'rejected'
  request.adminNotes = notes || '';
  request.reviewedAt = new Date().toISOString();

  // Save updated request
  await fetch(`${KV_URL}/set/${id}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(JSON.stringify(request))
  });

  // If approved, generate the study using Claude
  if (action === 'approved') {
    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
    const p = request;
    const cn = parseFloat(String(p.costConstruction || '0').replace(/,/g, '')) || 0;
    const sn = Math.round(cn * 0.10);
    const tot = cn + sn;
    const opx = Math.round(tot * 0.00025 * 30);
    const grd = tot + opx;
    const dn = parseInt(p.duration) || 12;

    function fmt(n) {
      if (!n) return '0';
      return Number(n).toLocaleString('ar-SA');
    }

    const info = `المشروع: ${p.projectName} | الموقع: ${p.location || 'جامعة أم القرى'} | النوع: ${p.projectType} | الوصف: ${p.description} | المبررات: ${p.justification || 'غير محدد'} | تكلفة التنفيذ: ${fmt(cn)} ريال | الإشراف: ${fmt(sn)} ريال | الإجمالي: ${fmt(tot)} ريال | المدة: ${p.duration} شهر | المستفيد: ${p.beneficiary || 'منسوبو الجامعة'} | مقدم الطلب: ${p.requesterName} | القسم: ${p.department || ''}`;

    const SYS = 'أنت خبير استشاري لدراسات الجدوى. أجب بنص عربي فقط. استخدم العلامات المحددة.';

    const q1 = `بيانات: ${info}\n\nاكتب:\n\nVISION:\n[4 جمل ربط المشروع برؤية 2030]\n\nPROGRAMS:\n- [ب1]\n- [ب2]\n- [ب3]\n\nOBJECTIVES:\n- [ه1]\n- [ه2]\n- [ه3]\n- [ه4]\n- [ه5]\n\nOBJ_D1:\n[شرح الهدف الأول]\n\nOBJ_D2:\n[شرح الهدف الثاني]\n\nOBJ_D3:\n[شرح الهدف الثالث]\n\nPROBLEMS:\n- [م1]\n- [م2]\n- [م3]\n\nPI1:\n[أثر م1]\n\nPI2:\n[أثر م2]\n\nPI3:\n[أثر م3]\n\nALIGNMENT:\n[3 جمل مواءمة قطاعية]\n\nSITUATION:\n[3 جمل الوضع الراهن]\n\nDEMAND:\n[4 جمل السعة والطلب]\n\nURGENCY:\n[جملتان]\n\nNEG1:\n[تبعة1]\n\nNEG2:\n[تبعة2]\n\nNEG3:\n[تبعة3]\n\nNEG4:\n[تبعة4]\n\nBEN_A:\n[أمني]\n\nBEN_S:\n[اجتماعي]\n\nBEN_U:\n[عمراني]\n\nBEN_O:\n[تشغيلي]\n\nCONTRACT:\n[4 جمل]\n\nPAYMENT:\n[جدول الدفعات]\n\nPROCS:\n- [و1]\n- [و2]\n- [و3]\n- [و4]\n- [و5]`;

    const q2 = `بيانات: ${info}\nمدة التنفيذ: ${dn} شهر\n\nاكتب:\n\nVE1:\n[مقترح1]\n\nVE2:\n[مقترح2]\n\nVE3:\n[مقترح3]\n\nVE4:\n[مقترح4]\n\nR1:\n[مخاطرة مالية1]\n\nR1M:\n[معالجة1]\n\nR2:\n[مخاطرة مالية2]\n\nR2M:\n[معالجة2]\n\nR3:\n[مخاطرة تقنية1]\n\nR3M:\n[معالجة3]\n\nR4:\n[مخاطرة تقنية2]\n\nR4M:\n[معالجة4]\n\nR5:\n[تشغيلية]\n\nR5M:\n[معالجة5]\n\nR6:\n[خارجية]\n\nR6M:\n[معالجة6]`;

    const [r1, r2] = await Promise.all([
      fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 3000, system: SYS, messages: [{ role: 'user', content: q1 }] })
      }),
      fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 3000, system: SYS, messages: [{ role: 'user', content: q2 }] })
      })
    ]);

    const d1 = await r1.json();
    const d2 = await r2.json();
    const t1 = d1.content ? d1.content.map(b => b.text || '').join('') : '';
    const t2 = d2.content ? d2.content.map(b => b.text || '').join('') : '';

    request.generatedData = { t1, t2, cn, sn, tot, opx, grd, dn };
    request.status = 'generated';

    await fetch(`${KV_URL}/set/${id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(JSON.stringify(request))
    });

    return res.status(200).json({ success: true, id, status: 'generated', data: { t1, t2, cn, sn, tot, opx, grd, dn } });
  }

  return res.status(200).json({ success: true, id, status: action });
}
