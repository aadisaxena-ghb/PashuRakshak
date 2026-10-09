import { getStore } from '../_store.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id } = req.query;
  const { cases } = getStore();
  const c = cases.find(item => String(item.id) === String(id));

  if (!c) {
    return res.status(404).json({ error: `Case ${id} not found` });
  }

  return res.status(200).json(c);
}
