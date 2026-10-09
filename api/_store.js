// Shared in-memory data store and risk engine for Vercel Serverless Functions

const SYMPTOM_WEIGHTS = {
  fever: 0.22,
  nasal_discharge: 0.18,
  loss_of_appetite: 0.12,
  lameness: 0.15,
  diarrhea: 0.20,
  skin_lesions: 0.24,
  labored_breathing: 0.28,
  sudden_death_nearby: 0.35,
  excessive_drooling: 0.19,
  reduced_milk_yield: 0.10,
  reduced_egg_production: 0.10,
  mouth_blisters: 0.25,
  skin_nodules: 0.24,
  excessive_salivation: 0.20,
  udder_swelling: 0.20,
  abnormal_milk: 0.18,
  discharge_eyes: 0.15,
  mild_bloat: 0.10,
  swelling_legs: 0.18,
};

const SPECIES_MULTIPLIER = {
  cattle: 1.0,
  buffalo: 1.0,
  goat: 0.95,
  sheep: 0.95,
  poultry: 1.1,
  pig: 1.05,
};

const DISEASE_DB = [
  {
    key: 'fmd',
    name: 'Foot-and-Mouth Disease (FMD)',
    symptoms: ['fever', 'loss_of_appetite', 'excessive_drooling', 'lameness', 'mouth_blisters', 'excessive_salivation'],
    species: ['cattle', 'buffalo', 'goat', 'sheep', 'pig'],
    note: 'Highly contagious viral disease; notifiable in most states.',
  },
  {
    key: 'lsd',
    name: 'Lumpy Skin Disease (LSD)',
    symptoms: ['fever', 'skin_lesions', 'loss_of_appetite', 'reduced_milk_yield', 'skin_nodules', 'swelling_legs'],
    species: ['cattle', 'buffalo'],
    note: 'Viral disease causing nodular skin lesions; vaccine-preventable.',
  },
  {
    key: 'ppr',
    name: 'Peste des Petits Ruminants (PPR)',
    symptoms: ['fever', 'diarrhea', 'nasal_discharge', 'loss_of_appetite', 'labored_breathing'],
    species: ['goat', 'sheep'],
    note: 'Highly fatal viral disease of small ruminants; vaccine-preventable.',
  },
  {
    key: 'hs',
    name: 'Hemorrhagic Septicemia (HS)',
    symptoms: ['fever', 'labored_breathing', 'sudden_death_nearby', 'loss_of_appetite'],
    species: ['cattle', 'buffalo'],
    note: 'Acute bacterial disease, can progress and kill within hours.',
  },
  {
    key: 'bq',
    name: 'Black Quarter (BQ)',
    symptoms: ['fever', 'lameness', 'sudden_death_nearby'],
    species: ['cattle', 'buffalo', 'sheep', 'goat'],
    note: 'Acute bacterial disease affecting muscle; often fatal without prompt treatment.',
  },
  {
    key: 'mastitis',
    name: 'Mastitis',
    symptoms: ['reduced_milk_yield', 'fever', 'udder_swelling', 'abnormal_milk'],
    species: ['cattle', 'buffalo', 'goat', 'sheep'],
    note: 'Udder infection; check for swelling, heat, or abnormal milk alongside these signs.',
  },
  {
    key: 'newcastle',
    name: 'Newcastle Disease',
    symptoms: ['labored_breathing', 'diarrhea', 'sudden_death_nearby', 'loss_of_appetite', 'reduced_egg_production'],
    species: ['poultry'],
    note: 'Highly contagious viral disease of poultry with high flock mortality.',
  },
  {
    key: 'avian_influenza',
    name: 'Avian Influenza',
    symptoms: ['labored_breathing', 'sudden_death_nearby', 'loss_of_appetite', 'fever', 'reduced_egg_production'],
    species: ['poultry'],
    note: 'Notifiable disease; report suspected cases to the local veterinary authority immediately.',
  },
  {
    key: 'swine_fever',
    name: 'Classical Swine Fever',
    symptoms: ['fever', 'loss_of_appetite', 'diarrhea', 'skin_lesions', 'sudden_death_nearby'],
    species: ['pig'],
    note: 'Highly contagious viral disease of pigs; vaccine-preventable.',
  },
  {
    key: 'anthrax',
    name: 'Anthrax',
    symptoms: ['sudden_death_nearby', 'fever', 'labored_breathing'],
    species: ['cattle', 'buffalo', 'goat', 'sheep', 'pig'],
    note: 'Zoonotic and notifiable. Do not open or handle a carcass suspected of anthrax.',
  },
  {
    key: 'enterotoxemia',
    name: 'Enterotoxemia',
    symptoms: ['diarrhea', 'sudden_death_nearby', 'loss_of_appetite'],
    species: ['goat', 'sheep'],
    note: 'Sudden-onset bacterial toxin disease, often in well-fed young animals.',
  },
  {
    key: 'brucellosis',
    name: 'Brucellosis',
    symptoms: ['reduced_milk_yield', 'loss_of_appetite'],
    species: ['cattle', 'buffalo', 'goat', 'sheep'],
    note: 'Chronic zoonotic disease; often also causes abortion, which isn\'t in this symptom list.',
  },
];

export function distanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const radlat1 = (Math.PI * lat1) / 180;
  const radlat2 = (Math.PI * lat2) / 180;
  const theta = lon1 - lon2;
  const radtheta = (Math.PI * theta) / 180;
  let dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
  dist = Math.min(1, Math.max(-1, dist));
  dist = Math.acos(dist);
  dist = (dist * 180) / Math.PI;
  dist = dist * 60 * 1.1515 * 1.609344;
  return dist;
}

export function assessRisk(species, ageMonths = 12, vaccinated = false, daysSinceOnset = 0, nearbyActiveCases = 0, symptoms = []) {
  let score = 0.0;
  const flaggedSymptoms = [];
  const spec = (species || 'cattle').toLowerCase();

  for (const sym of symptoms) {
    const w = SYMPTOM_WEIGHTS[sym] || 0.08;
    score += w;
    if (w >= 0.18) flaggedSymptoms.push(sym);
  }

  const speciesMult = SPECIES_MULTIPLIER[spec] || 1.0;
  score *= speciesMult;

  const durationBoost = Math.min(daysSinceOnset * 0.03, 0.20);
  score += durationBoost;

  const outbreakBoost = Math.min(nearbyActiveCases * 0.05, 0.25);
  score += outbreakBoost;

  if (vaccinated) score *= 0.85;
  if (ageMonths < 6 || ageMonths > 96) score *= 1.10;

  score = Math.max(0.0, Math.min(1.0, score));

  let level = 'LOW';
  let recommendation = 'No immediate action needed; continue routine observation.';
  if (score >= 0.75) {
    level = 'CRITICAL';
    recommendation = 'Refer to veterinarian immediately and isolate the animal.';
  } else if (score >= 0.50) {
    level = 'HIGH';
    recommendation = 'Refer to veterinarian within 24 hours.';
  } else if (score >= 0.25) {
    level = 'MEDIUM';
    recommendation = 'Monitor closely and re-check in 48 hours; contact vet if symptoms worsen.';
  }

  let explanation = 'Base symptom load contributed the largest share of the score';
  if (nearbyActiveCases > 0) explanation += `, raised further by ${nearbyActiveCases} active case(s) reported nearby`;
  if (vaccinated) explanation += ', partially offset by vaccination status';

  const possibleDiseases = [];
  for (const d of DISEASE_DB) {
    if (!d.species.includes(spec)) continue;
    let overlap = 0;
    for (const sym of d.symptoms) {
      if (symptoms.includes(sym)) overlap++;
    }
    if (overlap > 0) {
      const matchPercent = Math.round((100.0 * overlap) / d.symptoms.length);
      possibleDiseases.push({
        key: d.key,
        name: d.name,
        matchPercent,
        note: d.note,
        confidence: matchPercent >= 75 ? 'High' : matchPercent >= 45 ? 'Moderate' : 'Low',
        action: d.note
      });
    }
  }

  possibleDiseases.sort((a, b) => b.matchPercent - a.matchPercent);
  const topDiseases = possibleDiseases.slice(0, 3);

  return {
    riskScore: Math.round(score * 100),
    riskLevel: level,
    flaggedSymptoms,
    recommendation,
    explanation,
    possibleDiseases: topDiseases
  };
}

// In-Memory Database instances
globalThis.__VETS = globalThis.__VETS || [
  { id: 1, name: "Dr. Rajesh Sharma", phone: "011-23456789", assignedRegion: "Central Veterinary Polyclinic, New Delhi", latitude: 28.6139, longitude: 77.2090 },
  { id: 2, name: "Dr. Sunita Patel", phone: "0581-2300096", assignedRegion: "IVRI Regional Clinic, Bareilly, UP", latitude: 28.3975, longitude: 79.4313 },
  { id: 3, name: "Dr. Amit Kulkarni", phone: "020-25698741", assignedRegion: "District Veterinary Hospital, Pune, Maharashtra", latitude: 18.5204, longitude: 73.8567 },
  { id: 4, name: "Dr. Harpreet Singh", phone: "0161-2414002", assignedRegion: "GADVASU Veterinary Hospital, Ludhiana, Punjab", latitude: 30.9010, longitude: 75.8071 },
  { id: 5, name: "Dr. Meera Nambiar", phone: "04936-209200", assignedRegion: "KVASU Animal Clinic, Wayanad, Kerala", latitude: 11.5543, longitude: 75.9818 },
  { id: 6, name: "Dr. Rameshwar Rathore", phone: "0151-2200289", assignedRegion: "CVAS Veterinary Center, Bikaner, Rajasthan", latitude: 28.0229, longitude: 73.3119 },
  { id: 7, name: "Dr. Ananya Sen", phone: "033-25563123", assignedRegion: "WBUAFS Livestock Care, Kolkata, West Bengal", latitude: 22.5626, longitude: 88.3630 },
  { id: 8, name: "Dr. Bhupendra Yadav", phone: "05944-233347", assignedRegion: "GBPUAT Mobile Vet Unit, Pantnagar, Uttarakhand", latitude: 29.0222, longitude: 79.4908 },
  { id: 9, name: "Dr. Suresh Choudhary", phone: "07826-232145", assignedRegion: "Kamdhenu Animal Hospital, Durg, Chhattisgarh", latitude: 21.1645, longitude: 81.3346 },
  { id: 10, name: "Dr. Venkatesh Rao", phone: "08676-252258", assignedRegion: "NTR Vet Teaching Hospital, Gannavaram, Andhra Pradesh", latitude: 16.5385, longitude: 80.7963 },
  { id: 11, name: "Dr. Deepa Deshmukh", phone: "022-24131180", assignedRegion: "Bombay Veterinary Hospital, Mumbai, Maharashtra", latitude: 19.0069, longitude: 72.8398 },
  { id: 12, name: "Dr. Manoj Kumar", phone: "0612-2222231", assignedRegion: "Bihar Veterinary Dispensary, Patna, Bihar", latitude: 25.5976, longitude: 85.0843 }
];

globalThis.__CASES = globalThis.__CASES || [
  {
    id: 1,
    animal: {
      id: 1,
      species: "cattle",
      breed: "Gir Cow",
      ageMonths: 36,
      ownerName: "Ramesh Chand",
      ownerPhone: "9876543210",
      village: "Rampur",
      vaccinated: false,
      height: 140.0,
      weight: 380.0,
      unit: "metric"
    },
    village: "Rampur",
    symptoms: ["fever", "skin_nodules", "nasal_discharge", "loss_of_appetite", "swelling_legs"],
    daysSinceOnset: 3,
    nearbyActiveCases: 4,
    latitude: 28.6200,
    longitude: 77.2150,
    riskScore: 92.0,
    riskLevel: "CRITICAL",
    flaggedSymptoms: ["skin_nodules", "fever", "swelling_legs"],
    recommendation: "Immediate veterinary isolation and emergency supportive treatment required. Suspected severe Lumpy Skin Disease cluster.",
    explanation: "Multiple nodular cutaneous eruptions combined with high pyrexia and local village case clustering indicate a high-risk contagious outbreak.",
    possibleDiseasesJson: JSON.stringify([{ name: "Lumpy Skin Disease", confidence: "High", action: "Strict quarantine, fly vector control, antipyretic administration under vet supervision" }]),
    assignedVet: globalThis.__VETS[0],
    status: "REFERRED",
    reportedAt: new Date(Date.now() - 86400000).toISOString()
  },
  {
    id: 2,
    animal: {
      id: 2,
      species: "buffalo",
      breed: "Murrah",
      ageMonths: 48,
      ownerName: "Baldev Singh",
      ownerPhone: "9812345678",
      village: "Karnal",
      vaccinated: false
    },
    village: "Karnal",
    symptoms: ["excessive_salivation", "mouth_blisters", "lameness", "fever"],
    daysSinceOnset: 2,
    nearbyActiveCases: 3,
    latitude: 29.6857,
    longitude: 76.9905,
    riskScore: 84.0,
    riskLevel: "HIGH",
    flaggedSymptoms: ["mouth_blisters", "excessive_salivation", "lameness"],
    recommendation: "Isolate animal immediately. Apply mild antiseptic mouthwash (boroglycerine) and foot dip while awaiting assigned veterinarian.",
    explanation: "Vesicular lesions on oral mucosa and interdigital space with hypersalivation strongly correlate with acute Foot and Mouth Disease.",
    possibleDiseasesJson: JSON.stringify([{ name: "Foot and Mouth Disease (FMD)", confidence: "High", action: "Antiseptic foot wash, soft diet, immediate ring vaccination in 5km radius" }]),
    assignedVet: globalThis.__VETS[1],
    status: "REFERRED",
    reportedAt: new Date(Date.now() - 172800000).toISOString()
  },
  {
    id: 3,
    animal: {
      id: 3,
      species: "cattle",
      breed: "Sahiwal",
      ageMonths: 60,
      ownerName: "Gopal Yadav",
      ownerPhone: "9765432109",
      village: "Anand",
      vaccinated: true
    },
    village: "Anand",
    symptoms: ["udder_swelling", "abnormal_milk", "fever"],
    daysSinceOnset: 1,
    nearbyActiveCases: 1,
    latitude: 22.5645,
    longitude: 72.9289,
    riskScore: 58.0,
    riskLevel: "MEDIUM",
    flaggedSymptoms: ["udder_swelling", "abnormal_milk"],
    recommendation: "Perform strip cup test and California Mastitis Test (CMT). Maintain strict milking hygiene and consult vet for intramammary infusion.",
    explanation: "Acute udder inflammation with clotted milk consistency indicates localized bacterial mastitis.",
    possibleDiseasesJson: JSON.stringify([{ name: "Clinical Mastitis", confidence: "Medium-High", action: "Complete milking out, cold fomentation, vet prescribed antibiotic therapy" }]),
    status: "ASSESSED",
    reportedAt: new Date(Date.now() - 259200000).toISOString()
  },
  {
    id: 4,
    animal: {
      id: 4,
      species: "goat",
      breed: "Beetal",
      ageMonths: 14,
      ownerName: "Kisanrao More",
      ownerPhone: "9988776655",
      village: "Pune Rural",
      vaccinated: false
    },
    village: "Pune Rural",
    symptoms: ["skin_nodules", "mouth_blisters", "discharge_eyes", "loss_of_appetite"],
    daysSinceOnset: 4,
    nearbyActiveCases: 2,
    latitude: 18.5300,
    longitude: 73.8600,
    riskScore: 76.0,
    riskLevel: "HIGH",
    flaggedSymptoms: ["mouth_blisters", "skin_nodules"],
    recommendation: "Apply soothing antiseptic ointment on oral lesions. Prevent crust detachment and refer to local veterinary officer.",
    explanation: "Erosive labial scabs and ocular discharge in small ruminants indicate Capripoxvirus or Parapoxvirus manifestation.",
    possibleDiseasesJson: JSON.stringify([{ name: "Goat Pox / Contagious Ecthyma", confidence: "High", action: "Supportive antiseptic dressing, herd isolation, ring vaccination" }]),
    assignedVet: globalThis.__VETS[2],
    status: "REFERRED",
    reportedAt: new Date(Date.now() - 86400000).toISOString()
  },
  {
    id: 5,
    animal: {
      id: 5,
      species: "cattle",
      breed: "Crossbred HF",
      ageMonths: 24,
      ownerName: "Surendra Verma",
      ownerPhone: "9823456789",
      village: "Bareilly",
      vaccinated: true
    },
    village: "Bareilly",
    symptoms: ["mild_bloat", "reduced_rumination"],
    daysSinceOnset: 1,
    nearbyActiveCases: 0,
    latitude: 28.3900,
    longitude: 79.4300,
    riskScore: 25.0,
    riskLevel: "LOW",
    flaggedSymptoms: [],
    recommendation: "Provide light exercise, withhold grain concentrate for 12 hours, offer fresh green grass and digestive carminative mixture.",
    explanation: "Mild simple indigestion without systemic pyrexia or mucosal congestion.",
    possibleDiseasesJson: JSON.stringify([{ name: "Simple Indigestion / Tympany", confidence: "Moderate", action: "Carminative mixture, oral probiotics, dietary adjustment" }]),
    status: "RESOLVED",
    reportedAt: new Date(Date.now() - 432000000).toISOString()
  }
];

globalThis.__HOTSPOTS = globalThis.__HOTSPOTS || [
  { id: 1, village: "Rampur", activeCaseCount: 4, triggeredAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 2, village: "Karnal", activeCaseCount: 3, triggeredAt: new Date(Date.now() - 172800000).toISOString() }
];

export const getStore = () => ({
  vets: globalThis.__VETS,
  cases: globalThis.__CASES,
  hotspots: globalThis.__HOTSPOTS
});
