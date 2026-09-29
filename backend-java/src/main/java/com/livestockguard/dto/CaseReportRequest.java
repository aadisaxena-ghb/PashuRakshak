package com.livestockguard.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

/** What a field worker's app submits when reporting a sick animal. */
public class CaseReportRequest {

    @NotBlank
    private String species;

    private String breed;
    private Integer ageMonths;

    @NotBlank
    private String ownerName;

    private String ownerPhone;

    @NotBlank
    private String village;

    private Double latitude;
    private Double longitude;
    private Boolean vaccinated = false;
    private Integer daysSinceOnset = 0;
    
    // Optional specifications
    private Double height;
    private Double weight;
    private String unit;

    private String photoUrl;

    // Pre-computed result from /api/photo-analysis (JSON string), if the
    // reporter analyzed a photo before submitting. Optional.
    private String photoAnalysisJson;

    @NotEmpty
    private List<String> symptoms;

    // getters / setters

    public String getSpecies() { return species; }
    public void setSpecies(String species) { this.species = species; }

    public String getBreed() { return breed; }
    public void setBreed(String breed) { this.breed = breed; }

    public Integer getAgeMonths() { return ageMonths; }
    public void setAgeMonths(Integer ageMonths) { this.ageMonths = ageMonths; }

    public String getOwnerName() { return ownerName; }
    public void setOwnerName(String ownerName) { this.ownerName = ownerName; }

    public String getOwnerPhone() { return ownerPhone; }
    public void setOwnerPhone(String ownerPhone) { this.ownerPhone = ownerPhone; }

    public String getVillage() { return village; }
    public void setVillage(String village) { this.village = village; }

    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }

    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }

    public Boolean getVaccinated() { return vaccinated; }
    public void setVaccinated(Boolean vaccinated) { this.vaccinated = vaccinated; }

    public Integer getDaysSinceOnset() { return daysSinceOnset; }
    public void setDaysSinceOnset(Integer daysSinceOnset) { this.daysSinceOnset = daysSinceOnset; }

    public Double getHeight() { return height; }
    public void setHeight(Double height) { this.height = height; }

    public Double getWeight() { return weight; }
    public void setWeight(Double weight) { this.weight = weight; }

    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }

    public String getPhotoUrl() { return photoUrl; }
    public void setPhotoUrl(String photoUrl) { this.photoUrl = photoUrl; }

    public String getPhotoAnalysisJson() { return photoAnalysisJson; }
    public void setPhotoAnalysisJson(String photoAnalysisJson) { this.photoAnalysisJson = photoAnalysisJson; }

    public List<String> getSymptoms() { return symptoms; }
    public void setSymptoms(List<String> symptoms) { this.symptoms = symptoms; }
}
