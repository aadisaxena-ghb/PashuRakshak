package com.livestockguard.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.livestockguard.dto.CaseReportRequest;
import com.livestockguard.dto.RiskEngineResult;
import com.livestockguard.model.*;
import com.livestockguard.repository.AnimalRepository;
import com.livestockguard.repository.CaseReportRepository;
import com.livestockguard.repository.VetRepository;
import com.livestockguard.util.GeoUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

@Service
public class CaseService {

    private final AnimalRepository animalRepository;
    private final CaseReportRepository caseReportRepository;
    private final VetRepository vetRepository;
    private final RiskAssessmentService riskAssessmentService;
    private final HotspotService hotspotService;
    private final GooglePlacesService googlePlacesService;
    private final int hotspotWindowDays;
    private final double autoAssignRadiusKm;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public CaseService(AnimalRepository animalRepository,
                        CaseReportRepository caseReportRepository,
                        VetRepository vetRepository,
                        RiskAssessmentService riskAssessmentService,
                        HotspotService hotspotService,
                        GooglePlacesService googlePlacesService,
                        @Value("${livestockguard.hotspot.window-days}") int hotspotWindowDays,
                        @Value("${livestockguard.auto-assign.radius-km:100}") double autoAssignRadiusKm) {
        this.animalRepository = animalRepository;
        this.caseReportRepository = caseReportRepository;
        this.vetRepository = vetRepository;
        this.riskAssessmentService = riskAssessmentService;
        this.hotspotService = hotspotService;
        this.googlePlacesService = googlePlacesService;
        this.hotspotWindowDays = hotspotWindowDays;
        this.autoAssignRadiusKm = autoAssignRadiusKm;
    }

    @Transactional
    public CaseReport reportCase(CaseReportRequest request) {
        Animal animal = new Animal();
        animal.setSpecies(request.getSpecies());
        animal.setBreed(request.getBreed());
        animal.setAgeMonths(request.getAgeMonths());
        animal.setOwnerName(request.getOwnerName());
        animal.setOwnerPhone(request.getOwnerPhone());
        animal.setVillage(request.getVillage());
        animal.setVaccinated(Boolean.TRUE.equals(request.getVaccinated()));
        animal.setHeight(request.getHeight());
        animal.setWeight(request.getWeight());
        animal.setUnit(request.getUnit());
        animal = animalRepository.save(animal);

        Instant windowStart = Instant.now().minus(hotspotWindowDays, ChronoUnit.DAYS);
        int nearbyActiveCases = caseReportRepository
                .findByVillageAndReportedAtAfter(request.getVillage(), windowStart)
                .size();

        RiskEngineResult result = riskAssessmentService.assess(
                request.getSpecies(),
                request.getAgeMonths(),
                Boolean.TRUE.equals(request.getVaccinated()),
                request.getDaysSinceOnset() == null ? 0 : request.getDaysSinceOnset(),
                nearbyActiveCases,
                request.getSymptoms()
        );

        CaseReport caseReport = new CaseReport();
        caseReport.setAnimal(animal);
        caseReport.setSymptoms(request.getSymptoms());
        caseReport.setDaysSinceOnset(request.getDaysSinceOnset());
        caseReport.setNearbyActiveCases(nearbyActiveCases);
        caseReport.setPhotoUrl(request.getPhotoUrl());
        caseReport.setPhotoAnalysisJson(request.getPhotoAnalysisJson());
        caseReport.setVillage(request.getVillage());
        caseReport.setLatitude(request.getLatitude());
        caseReport.setLongitude(request.getLongitude());
        caseReport.setRiskScore(result.riskScore);
        caseReport.setRiskLevel(RiskLevel.valueOf(result.riskLevel));
        caseReport.setFlaggedSymptoms(result.flaggedSymptoms);
        caseReport.setRecommendation(result.recommendation);
        caseReport.setExplanation(result.explanation);
        try {
            caseReport.setPossibleDiseasesJson(objectMapper.writeValueAsString(result.possibleDiseases));
        } catch (Exception e) {
            caseReport.setPossibleDiseasesJson("[]");
        }
        caseReport.setStatus(CaseStatus.ASSESSED);

        caseReport = caseReportRepository.save(caseReport);

        if ((caseReport.getRiskLevel() == RiskLevel.HIGH || caseReport.getRiskLevel() == RiskLevel.CRITICAL)
                && caseReport.getLatitude() != null && caseReport.getLongitude() != null) {
            autoAssignNearestVet(caseReport);
        }

        hotspotService.reevaluateVillage(request.getVillage());

        return caseReport;
    }

    /**
     * On a serious case with a location, try to connect it to a vet
     * automatically rather than leaving it to sit unassigned:
     *  1. Prefer a registered vet (one someone added via the Veterinary
     *     desk) within a sane radius — this is a real, formal assignment.
     *  2. If none is close enough, and Google Places is configured, fall
     *     back to the single nearest real clinic Google knows about and
     *     store it as a suggestion (not a formal FK assignment, since we
     *     don't manage that clinic's record).
     */
    private void autoAssignNearestVet(CaseReport caseReport) {
        double lat = caseReport.getLatitude();
        double lng = caseReport.getLongitude();

        Optional<Vet> nearestRegistered = vetRepository.findAll().stream()
                .filter(v -> v.getLatitude() != null && v.getLongitude() != null)
                .min(Comparator.comparingDouble(v -> GeoUtils.distanceKm(lat, lng, v.getLatitude(), v.getLongitude())));

        if (nearestRegistered.isPresent()
                && GeoUtils.distanceKm(lat, lng, nearestRegistered.get().getLatitude(), nearestRegistered.get().getLongitude()) <= autoAssignRadiusKm) {
            caseReport.setAssignedVet(nearestRegistered.get());
            caseReport.setStatus(CaseStatus.REFERRED);
            caseReportRepository.save(caseReport);
            return;
        }

        if (googlePlacesService.isConfigured()) {
            googlePlacesService.findClosestVet(lat, lng).ifPresent(vet -> {
                caseReport.setSuggestedVetName(vet.name);
                caseReport.setSuggestedVetAddress(vet.address);
                caseReport.setSuggestedVetMapsUrl(vet.mapsUrl);
                caseReportRepository.save(caseReport);
            });
        }
    }

    public List<CaseReport> listCases() {
        return caseReportRepository.findAllByOrderByReportedAtDesc();
    }

    public CaseReport getCase(Long id) {
        return caseReportRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Case " + id + " not found"));
    }

    @Transactional
    public CaseReport assignVet(Long caseId, Long vetId) {
        CaseReport caseReport = getCase(caseId);
        Vet vet = vetRepository.findById(vetId)
                .orElseThrow(() -> new NoSuchElementException("Vet " + vetId + " not found"));
        caseReport.setAssignedVet(vet);
        caseReport.setStatus(CaseStatus.REFERRED);
        return caseReportRepository.save(caseReport);
    }

    @Transactional
    public CaseReport updateStatus(Long caseId, CaseStatus status) {
        CaseReport caseReport = getCase(caseId);
        caseReport.setStatus(status);
        return caseReportRepository.save(caseReport);
    }

    public static class NoSuchElementException extends RuntimeException {
        public NoSuchElementException(String message) { super(message); }
    }
}
