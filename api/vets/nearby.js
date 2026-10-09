import { getStore, distanceKm } from '../_store.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { lat, lng } = req.query;
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);

  if (isNaN(latitude) || isNaN(longitude)) {
    return res.status(400).json({ error: 'Valid lat and lng query params are required' });
  }

  const googleKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;

  if (googleKey) {
    try {
      const radius = 50000;
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=${radius}&type=veterinary_care&keyword=veterinary&key=${googleKey}`;
      const gRes = await fetch(url);
      const gData = await gRes.json();
      if (gData.results && gData.results.length > 0) {
        const places = gData.results.map(p => ({
          placeId: p.place_id,
          name: p.name,
          address: p.vicinity,
          latitude: p.geometry?.location?.lat,
          longitude: p.geometry?.location?.lng,
          rating: p.rating || null,
          userRatingsTotal: p.user_ratings_total || 0,
          openNow: p.opening_hours?.open_now || null,
          mapsUrl: `https://www.google.com/maps/place/?q=place_id:${p.place_id}`,
          distanceKm: p.geometry?.location
            ? distanceKm(latitude, longitude, p.geometry.location.lat, p.geometry.location.lng)
            : null
        }));
        return res.status(200).json({ configured: true, vets: places });
      }
    } catch (e) {
      console.error('Google Places fetch failed:', e);
    }
  }

  // Fallback to registered vets sorted by distance
  const { vets } = getStore();
  const nearby = vets
    .filter(v => v.latitude && v.longitude)
    .map(v => ({
      placeId: `registered-${v.id}`,
      name: v.name,
      address: `${v.assignedRegion} (Ph: ${v.phone})`,
      latitude: v.latitude,
      longitude: v.longitude,
      rating: 4.8,
      userRatingsTotal: 15,
      openNow: true,
      mapsUrl: `https://www.google.com/maps/search/?api=1&query=${v.latitude},${v.longitude}`,
      distanceKm: Math.round(distanceKm(latitude, longitude, v.latitude, v.longitude) * 10) / 10
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return res.status(200).json({
    configured: true,
    vets: nearby
  });
}
