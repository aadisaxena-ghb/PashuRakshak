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
 * Integrates Google Gemini Vision API, with an automated fallback for demo stability.
 */
@Service
public class ImageDiagnosisService {

    private final String apiKey;
    private final String model;
    private final HttpClient httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final String SYSTEM_PROMPT = """
        You are assisting a village animal-health field worker in India who has photographed a
        sick or injured farm animal. You are NOT a veterinarian and this is NOT a diagnosis —
        it is a preliminary visual read to help the worker decide urgency and what to tell a vet.

        CRITICAL REQUIREMENT: First, verify that the photo actually contains the specified animal species. 
        If the photo contains humans, completely unrelated objects, just the ground, rubbish, or a fake/unrelated image, 
        you MUST set "imageUsable" to false and provide a helpful "retakeMessage" (e.g., "This image does not appear to show the specified animal. Please upload a clear photo of the sick animal.").

        Respond with ONLY a single JSON object (no markdown, no prose outside the JSON) with
        exactly this shape:
        {
          "imageUsable": boolean,
          "retakeMessage": string or null,
          "visibleSigns": [string],
          "possibleConditions": [ { "name": string, "likelihood": "low"|"medium"|"high", "description": string } ],
          "firstAid": [string],
          "disclaimer": string
        }

        Be conservative: if the photo doesn't clearly show anything diagnostically useful for the stated species, say so in
        imageUsable/retakeMessage rather than guessing. Never invent medication names or dosages under
        any circumstance — firstAid must stay to general supportive care only.
        """;

    public ImageDiagnosisService(
            @Value("${gemini.api-key:${GEMINI_API_KEY:${anthropic.api-key:}}}") String apiKey,
            @Value("${gemini.model:gemini-2.0-flash}") String model) {
        this.apiKey = apiKey;
        this.model = (model == null || model.isBlank() || model.contains("claude")) ? "gemini-2.0-flash" : model;
    }

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    public Map<String, Object> analyze(ImageAnalysisRequest request) {
        if (!isConfigured()) {
            throw new IllegalStateException("Gemini API key is not configured.");
        }
        try {
            return callGemini(request);
        } catch (Exception e) {
            throw new ImageDiagnosisException("Gemini API call failed: " + e.getMessage(), e);
        }
    }

    private Map<String, Object> callGemini(ImageAnalysisRequest request) throws Exception {
        String userText = "Species: " + (request.getSpecies() == null ? "unspecified" : request.getSpecies())
                + ". Analyze this photo of the animal per your instructions.";

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
        String url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + apiKey;

        HttpRequest httpRequest = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(12))
                .header("Content-Type", "application/json")
                .header("x-goog-api-key", apiKey)
                .POST(HttpRequest.BodyPublishers.ofString(requestJson, StandardCharsets.UTF_8))
                .build();

        HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        JsonNode root = objectMapper.readTree(response.body());

        if (root.has("error")) {
            throw new ImageDiagnosisException("Gemini API error: " + root.path("error").path("message").asText());
        }

        JsonNode candidates = root.path("candidates");
        if (!candidates.isArray() || candidates.isEmpty()) {
            throw new ImageDiagnosisException("Gemini API returned no candidates");
        }

        String text = candidates.get(0).path("content").path("parts").get(0).path("text").asText();
        text = text.trim();
        if (text.startsWith("```")) {
            text = text.replaceAll("^```(json)?", "").replaceAll("```$", "").trim();
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> parsed = objectMapper.readValue(text, Map.class);
        return new LinkedHashMap<>(parsed);
    }

    public static class ImageDiagnosisException extends RuntimeException {
        public ImageDiagnosisException(String message) { super(message); }
        public ImageDiagnosisException(String message, Throwable cause) { super(message, cause); }
    }
}
