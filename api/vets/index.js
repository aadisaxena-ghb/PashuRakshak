import { getStore } from '../_store.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { vets } = getStore();

  if (req.method === 'GET') {
    return res.status(200).json(vets);
  }

  if (req.method === 'POST') {
    const { name, phone, assignedRegion, latitude, longitude } = req.body || {};
    const newId = vets.length > 0 ? Math.max(...vets.map(v => v.id || 0)) + 1 : 1;
    const newVet = {
      id: newId,
      name,
      phone,
      assignedRegion,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null
    };
    vets.push(newVet);
    return res.status(200).json(newVet);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
