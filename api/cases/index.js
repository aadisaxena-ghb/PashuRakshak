import { getStore, assessRisk, distanceKm } from '../_store.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { cases, vets, hotspots } = getStore();

  if (req.method === 'GET') {
    return res.status(200).json(cases);
  }

  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      const {
        species = 'cattle',
        breed,
        ageMonths = 12,
        ownerName,
        ownerPhone,
        village = 'Default',
        vaccinated = false,
        height,
        weight,
        unit = 'metric',
        symptoms = [],
        daysSinceOnset = 0,
        photoUrl,
        photoAnalysisJson,
        latitude,
        longitude
      } = body;

      // Count nearby active cases in the last 14 days
      const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      const nearbyActiveCases = cases.filter(c =>
        c.village?.toLowerCase() === village?.toLowerCase() &&
        new Date(c.reportedAt).getTime() >= fourteenDaysAgo
      ).length;

      // Assess risk using the weighted model
      const assessment = assessRisk(species, ageMonths, vaccinated, daysSinceOnset, nearbyActiveCases, symptoms);

      const newId = cases.length > 0 ? Math.max(...cases.map(c => c.id || 0)) + 1 : 1;

      const animal = {
        id: newId,
        species,
        breed,
        ageMonths,
        ownerName,
        ownerPhone,
        village,
        vaccinated,
        height,
        weight,
        unit
      };

      const newCase = {
        id: newId,
        animal,
        village,
        symptoms,
        daysSinceOnset,
        nearbyActiveCases,
        photoUrl,
        photoAnalysisJson,
        latitude,
        longitude,
        riskScore: assessment.riskScore,
        riskLevel: assessment.riskLevel,
        flaggedSymptoms: assessment.flaggedSymptoms,
        recommendation: assessment.recommendation,
        explanation: assessment.explanation,
        possibleDiseasesJson: JSON.stringify(assessment.possibleDiseases),
        status: 'ASSESSED',
        reportedAt: new Date().toISOString()
      };

      // Auto-assign nearest vet if high/critical and location available
      if ((newCase.riskLevel === 'HIGH' || newCase.riskLevel === 'CRITICAL') && latitude && longitude) {
        const availableVets = vets.filter(v => v.latitude && v.longitude);
        if (availableVets.length > 0) {
          let closest = availableVets[0];
          let minDist = distanceKm(latitude, longitude, closest.latitude, closest.longitude);
          for (let i = 1; i < availableVets.length; i++) {
            const d = distanceKm(latitude, longitude, availableVets[i].latitude, availableVets[i].longitude);
            if (d < minDist) {
              minDist = d;
              closest = availableVets[i];
            }
          }
          if (minDist <= 100) {
            newCase.assignedVet = closest;
            newCase.status = 'REFERRED';
          }
        }
      }

      // Add to beginning of cases list
      cases.unshift(newCase);

      // Re-evaluate hotspot for village
      const activeCount = cases.filter(c =>
        c.village?.toLowerCase() === village?.toLowerCase() &&
        (c.riskLevel === 'HIGH' || c.riskLevel === 'CRITICAL') &&
        new Date(c.reportedAt).getTime() >= fourteenDaysAgo
      ).length;

      if (activeCount >= 3) {
        const existing = hotspots.find(h => h.village?.toLowerCase() === village?.toLowerCase());
        if (existing) {
          existing.activeCaseCount = activeCount;
          existing.triggeredAt = new Date().toISOString();
        } else {
          hotspots.push({
            id: hotspots.length + 1,
            village,
            activeCaseCount: activeCount,
            triggeredAt: new Date().toISOString()
          });
        }
      }

      return res.status(200).json(newCase);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
