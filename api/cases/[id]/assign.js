import { getStore } from '../../_store.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const { vetId } = req.body || {};
  const { cases, vets } = getStore();

  const c = cases.find(item => String(item.id) === String(id));
  if (!c) {
    return res.status(404).json({ error: `Case ${id} not found` });
  }

  const v = vets.find(item => String(item.id) === String(vetId));
  if (!v) {
    return res.status(404).json({ error: `Vet ${vetId} not found` });
  }

  c.assignedVet = v;
  c.status = 'REFERRED';
  return res.status(200).json(c);
}
