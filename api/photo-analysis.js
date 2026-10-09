export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-goog-api-key');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { species, imageBase64, mediaType, apiKey } = req.body || {};
    const effectiveKey = (apiKey && apiKey.trim() && !apiKey.startsWith('YOUR_'))
      ? apiKey.trim()
      : (process.env.GEMINI_API_KEY || '');

    if (!effectiveKey) {
      return res.status(200).json({
        configured: false,
        imageUsable: false,
        retakeMessage: 'Photo analysis requires a Google Gemini Vision API key to verify and diagnose animal images accurately without false positives. Please enter your Gemini API key below.',
        visibleSigns: [],
        possibleConditions: [],
        firstAid: [],
        disclaimer: 'Gemini API key required for neural vision analysis.'
      });
    }

    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing imageBase64' });
    }

    const systemPrompt = `You are an expert veterinary visual screening assistant for rural livestock field workers in India.
Your primary responsibility is to strictly verify whether the photo shows a genuine sick or injured farm/domestic animal of the specified species.

CRITICAL VERIFICATION RULES:
1. If the photo is:
   - A person, face, selfie, or body part
   - An unrelated object (room, furniture, vehicle, desk, food, electronics, building, tool)
   - A digital graphic, screenshot, poster, arcade badge, game art, meme, logo, or cartoon
   - A healthy animal with no visible signs of illness, lesion, wound, rash, or distress
   - Ambiguous, unidentifiable, or not an animal
   THEN YOU MUST SET "imageUsable": false and provide a helpful, polite "retakeMessage" explaining that the photo does not appear to show a sick or injured livestock animal and requesting a clear, focused photo of the animal.
   Set "visibleSigns": [], "possibleConditions": [], "firstAid": [].

2. ONLY if the photo clearly shows a genuine sick or injured livestock animal of the stated species:
   - Set "imageUsable": true
   - Set "retakeMessage": null
   - "visibleSigns": list 2-4 specific visual clinical signs observed in the photo (e.g., "Circumscribed erythematous nodules on skin", "Oral mucosal erosions with drooling", "Interdigital hoof swelling")
   - "possibleConditions": list 1-3 likely conditions based on visible signs with "likelihood" ("high"|"medium"|"low") and a clear explanation
   - "firstAid": list 3-4 safe, supportive care steps (isolation, clean wound washing, fresh water, soft forage)
   - "disclaimer": "Preliminary AI visual screening for field decision-support. Not a diagnostic guarantee; refer to a registered veterinarian."

Respond with ONLY a single JSON object with this exact shape:
{
  "imageUsable": boolean,
  "retakeMessage": string or null,
  "visibleSigns": [string],
  "possibleConditions": [
    { "name": string, "likelihood": "low"|"medium"|"high", "description": string }
  ],
  "firstAid": [string],
  "disclaimer": string
}`;

    const payload = {
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [
        {
          parts: [
            { text: `Species: ${species || 'unspecified'}. Strictly inspect and analyze this photo per your instructions.` },
            {
              inline_data: {
                mime_type: mediaType || 'image/jpeg',
                data: imageBase64
              }
            }
          ]
        }
      ],
      generationConfig: {
        response_mime_type: 'application/json',
        max_output_tokens: 1000
      }
    };

    const models = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-flash-latest'];
    let lastError = null;

    for (const model of models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          if (attempt > 0) {
            await new Promise(r => setTimeout(r, 600));
          }

          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${effectiveKey}`;
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': effectiveKey
            },
            body: JSON.stringify(payload)
          });

          const data = await response.json();
          if (data.error) {
            const msg = data.error.message || '';
            lastError = msg;
            if (msg.includes('high demand') || msg.includes('quota') || msg.includes('429') || msg.includes('503')) {
              continue;
            }
            if (msg.includes('not found') || data.error.code === 404) {
              break;
            }
            throw new Error(msg);
          }

          const candidate = data.candidates?.[0];
          const parts = candidate?.content?.parts || [];
          let rawText = '';
          for (const p of parts) {
            if (p.text) {
              rawText += p.text;
            }
          }

          if (!rawText && parts.length > 0) {
            rawText = parts[0].text || '';
          }

          if (!rawText) {
            throw new Error('No text returned in candidate parts');
          }

          let parsed = null;
          let cleanText = rawText.trim().replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
          try {
            parsed = JSON.parse(cleanText);
          } catch (e) {
            const firstBrace = cleanText.indexOf('{');
            const lastBrace = cleanText.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace > firstBrace) {
              parsed = JSON.parse(cleanText.substring(firstBrace, lastBrace + 1));
            } else {
              throw e;
            }
          }

          parsed.configured = true;
          return res.status(200).json(parsed);
        } catch (err) {
          lastError = err.message;
        }
      }
    }

    return res.status(200).json({
      configured: true,
      imageUsable: false,
      retakeMessage: `AI Vision analysis is temporarily busy (${lastError || 'rate limit'}). Please try again in a moment.`,
      visibleSigns: [],
      possibleConditions: [],
      firstAid: [],
      disclaimer: 'AI Vision service retry.'
    });
  } catch (error) {
    return res.status(500).json({
      configured: true,
      imageUsable: false,
      retakeMessage: `Server error: ${error.message}`,
      visibleSigns: [],
      possibleConditions: [],
      firstAid: [],
      disclaimer: 'Server error'
    });
  }
}
