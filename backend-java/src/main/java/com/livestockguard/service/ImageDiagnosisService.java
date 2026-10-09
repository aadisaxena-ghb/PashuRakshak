package com.livestockguard.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.livestockguard.dto.ImageAnalysisRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Looks at a photo of a sick animal and returns a preliminary visual read.
 * Integrates Google Gemini Vision API for authentic multimodal analysis.
 */
@Service
public class ImageDiagnosisService {

    private final String apiKey;
    private final String model;
    private final HttpClient httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(12)).build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final String SYSTEM_PROMPT = """
        You are an expert veterinary visual screening assistant for rural livestock field workers in India.
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
        }
        """;

    public ImageDiagnosisService(
            @Value("${gemini.api-key:${GEMINI_API_KEY:${anthropic.api-key:}}}") String apiKey,
            @Value("${gemini.model:gemini-3.8-flash}") String model) {
        this.apiKey = apiKey;
        this.model = (model == null || model.isBlank() || model.contains("claude")) ? "gemini-3.8-flash" : model;
    }

    public boolean isConfigured() {
        return true;
    }

    public Map<String, Object> analyze(ImageAnalysisRequest request) {
        String effectiveKey = (request.getApiKey() != null && !request.getApiKey().isBlank())
                ? request.getApiKey().trim()
                : this.apiKey;

        if (effectiveKey != null && !effectiveKey.isBlank() && !effectiveKey.startsWith("YOUR_")) {
            try {
                return callGemini(request, effectiveKey);
            } catch (Exception e) {
                Map<String, Object> errRes = new LinkedHashMap<>();
                errRes.put("imageUsable", false);
                errRes.put("retakeMessage", "AI Vision check failed: " + e.getMessage() + ". Please ensure your Gemini API key is valid.");
                errRes.put("visibleSigns", List.of());
                errRes.put("possibleConditions", List.of());
                errRes.put("firstAid", List.of());
                errRes.put("disclaimer", "AI Vision service error.");
                return errRes;
            }
        }

        // When no Gemini key is provided, never invent fake disease details for arbitrary photos.
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("imageUsable", false);
        result.put("retakeMessage", "Photo analysis requires a Google Gemini Vision API key to verify and diagnose animal images accurately without false positives. Please enter your Gemini API key below.");
        result.put("visibleSigns", List.of());
        result.put("possibleConditions", List.of());
        result.put("firstAid", List.of());
        result.put("disclaimer", "Gemini API key required for neural vision analysis.");
        return result;
    }

    private Map<String, Object> callGemini(ImageAnalysisRequest request, String keyToUse) throws Exception {
        String userText = "Species: " + (request.getSpecies() == null ? "unspecified" : request.getSpecies())
                + ". Strictly inspect and analyze this photo per your instructions.";

        Map<String, Object> inlineData = Map.of(
                "mime_type", request.getMediaType() != null ? request.getMediaType() : "image/jpeg",
                "data", request.getImageBase64()
        );

        Map<String, Object> textPart = Map.of("text", userText);
        Map<String, Object> imagePart = Map.of("inline_data", inlineData);

        Map<String, Object> systemInstruction = Map.of(
                "parts", List.of(Map.of("text", SYSTEM_PROMPT))
        );

        Map<String, Object> generationConfig = Map.of(
                "response_mime_type", "application/json",
                "max_output_tokens", 1000
        );

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("system_instruction", systemInstruction);
        body.put("contents", List.of(Map.of("parts", List.of(textPart, imagePart))));
        body.put("generationConfig", generationConfig);

        String requestJson = objectMapper.writeValueAsString(body);

        String[] modelsToTry = new String[]{model, "gemini-3.8-flash", "gemini-2.5-flash", "gemini-1.5-flash"};
        Exception lastException = null;

        for (String m : modelsToTry) {
            try {
                String url = "https://generativelanguage.googleapis.com/v1beta/models/" + m + ":generateContent?key=" + keyToUse;

                HttpRequest httpRequest = HttpRequest.newBuilder(URI.create(url))
                        .timeout(Duration.ofSeconds(15))
                        .header("Content-Type", "application/json")
                        .header("x-goog-api-key", keyToUse)
                        .POST(HttpRequest.BodyPublishers.ofString(requestJson, StandardCharsets.UTF_8))
                        .build();

                HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
                JsonNode root = objectMapper.readTree(response.body());

                if (root.has("error")) {
                    String msg = root.path("error").path("message").asText();
                    if (msg.contains("not found") || msg.contains("404")) {
                        lastException = new ImageDiagnosisException(msg);
                        continue; // try next model
                    }
                    throw new ImageDiagnosisException(msg);
                }

                JsonNode candidates = root.path("candidates");
                if (!candidates.isArray() || candidates.isEmpty()) {
                    throw new ImageDiagnosisException("Gemini returned no candidates");
                }

                String text = candidates.get(0).path("content").path("parts").get(0).path("text").asText();
                text = text.trim();
                if (text.startsWith("```")) {
                    text = text.replaceAll("^```(json)?", "").replaceAll("```$", "").trim();
                }

                @SuppressWarnings("unchecked")
                Map<String, Object> parsed = objectMapper.readValue(text, Map.class);
                return new LinkedHashMap<>(parsed);

            } catch (Exception e) {
                lastException = e;
            }
        }

        throw (lastException != null) ? lastException : new ImageDiagnosisException("Failed to analyze image with Gemini Vision");
    }

    public static class ImageDiagnosisException extends RuntimeException {
        public ImageDiagnosisException(String message) { super(message); }
        public ImageDiagnosisException(String message, Throwable cause) { super(message, cause); }
    }
}
