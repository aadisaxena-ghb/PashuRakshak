package com.livestockguard.dto;

import jakarta.validation.constraints.NotBlank;

public class ImageAnalysisRequest {
    @NotBlank
    private String imageBase64; // raw base64, no "data:image/...;base64," prefix

    @NotBlank
    private String mediaType; // e.g. "image/jpeg", "image/png"

    private String species; // optional context, e.g. "cattle"
    private String apiKey; // optional client-provided key

    public String getImageBase64() { return imageBase64; }
    public void setImageBase64(String imageBase64) { this.imageBase64 = imageBase64; }

    public String getMediaType() { return mediaType; }
    public void setMediaType(String mediaType) { this.mediaType = mediaType; }

    public String getSpecies() { return species; }
    public void setSpecies(String species) { this.species = species; }

    public String getApiKey() { return apiKey; }
    public void setApiKey(String apiKey) { this.apiKey = apiKey; }
}
