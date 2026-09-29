package com.livestockguard.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.livestockguard.model.*;
import com.livestockguard.repository.AnimalRepository;
import com.livestockguard.repository.CaseReportRepository;
import com.livestockguard.repository.HotspotAlertRepository;
import com.livestockguard.repository.VetRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Configuration;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

/**
 * Automatically pre-seeds realistic veterinary doctors, sample cases, and outbreak hotspots
 * on first launch so the prototype is 100% demo-ready and presentation-rich immediately.
 */
@Configuration
public class DataInitializer implements CommandLineRunner {

    private final VetRepository vetRepository;
    private final AnimalRepository animalRepository;
    private final CaseReportRepository caseReportRepository;
    private final HotspotAlertRepository hotspotAlertRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public DataInitializer(VetRepository vetRepository,
                           AnimalRepository animalRepository,
                           CaseReportRepository caseReportRepository,
                           HotspotAlertRepository hotspotAlertRepository) {
        this.vetRepository = vetRepository;
        this.animalRepository = animalRepository;
        this.caseReportRepository = caseReportRepository;
        this.hotspotAlertRepository = hotspotAlertRepository;
    }

    @Override
    public void run(String... args) throws Exception {
        if (vetRepository.count() == 0) {
            seedVeterinarians();
        }
        if (caseReportRepository.count() == 0) {
            seedSampleCases();
        }
    }

    private void seedVeterinarians() {
        List<Vet> vets = List.of(
                createVet("Dr. Rajesh Sharma", "011-23456789", "Central Veterinary Polyclinic, New Delhi", 28.6139, 77.2090),
                createVet("Dr. Sunita Patel", "0581-2300096", "IVRI Regional Clinic, Bareilly, UP", 28.3975, 79.4313),
                createVet("Dr. Amit Kulkarni", "020-25698741", "District Veterinary Hospital, Pune, Maharashtra", 18.5204, 73.8567),
                createVet("Dr. Harpreet Singh", "0161-2414002", "GADVASU Veterinary Hospital, Ludhiana, Punjab", 30.9010, 75.8071),
                createVet("Dr. Meera Nambiar", "04936-209200", "KVASU Animal Clinic, Wayanad, Kerala", 11.5543, 75.9818),
                createVet("Dr. Rameshwar Rathore", "0151-2200289", "CVAS Veterinary Center, Bikaner, Rajasthan", 28.0229, 73.3119),
                createVet("Dr. Ananya Sen", "033-25563123", "WBUAFS Livestock Care, Kolkata, West Bengal", 22.5626, 88.3630),
                createVet("Dr. Bhupendra Yadav", "05944-233347", "GBPUAT Mobile Vet Unit, Pantnagar, Uttarakhand", 29.0222, 79.4908),
                createVet("Dr. Suresh Choudhary", "07826-232145", "Kamdhenu Animal Hospital, Durg, Chhattisgarh", 21.1645, 81.3346),
                createVet("Dr. Venkatesh Rao", "08676-252258", "NTR Vet Teaching Hospital, Gannavaram, Andhra Pradesh", 16.5385, 80.7963),
                createVet("Dr. Deepa Deshmukh", "022-24131180", "Bombay Veterinary Hospital, Mumbai, Maharashtra", 19.0069, 72.8398),
                createVet("Dr. Manoj Kumar", "0612-2222231", "Bihar Veterinary Dispensary, Patna, Bihar", 25.5976, 85.0843)
        );
        vetRepository.saveAll(vets);
    }

    private Vet createVet(String name, String phone, String region, double lat, double lng) {
        Vet v = new Vet();
        v.setName(name);
        v.setPhone(phone);
        v.setAssignedRegion(region);
        v.setLatitude(lat);
        v.setLongitude(lng);
        return v;
    }

    private void seedSampleCases() throws Exception {
        List<Vet> vets = vetRepository.findAll();
        Vet drRajesh = vets.isEmpty() ? null : vets.get(0);
        Vet drSunita = vets.size() > 1 ? vets.get(1) : drRajesh;
        Vet drAmit = vets.size() > 2 ? vets.get(2) : drRajesh;

        // Case 1: Lumpy Skin Disease - CRITICAL (Rampur cluster)
        Animal a1 = new Animal();
        a1.setSpecies("cattle");
        a1.setBreed("Gir Cow");
        a1.setAgeMonths(36);
        a1.setOwnerName("Ramesh Chand");
        a1.setOwnerPhone("9876543210");
        a1.setVillage("Rampur");
        a1.setVaccinated(false);
        a1.setHeight(140.0);
        a1.setWeight(380.0);
        a1.setUnit("metric");
        a1 = animalRepository.save(a1);

        CaseReport c1 = new CaseReport();
        c1.setAnimal(a1);
        c1.setVillage("Rampur");
        c1.setSymptoms(List.of("fever", "skin_nodules", "nasal_discharge", "loss_of_appetite", "swelling_legs"));
        c1.setDaysSinceOnset(3);
        c1.setNearbyActiveCases(4);
        c1.setLatitude(28.6200);
        c1.setLongitude(77.2150);
        c1.setRiskScore(92.0);
        c1.setRiskLevel(RiskLevel.CRITICAL);
        c1.setFlaggedSymptoms(List.of("skin_nodules", "fever", "swelling_legs"));
        c1.setRecommendation("Immediate veterinary isolation and emergency supportive treatment required. Suspected severe Lumpy Skin Disease cluster.");
        c1.setExplanation("Multiple nodular cutaneous eruptions combined with high pyrexia and local village case clustering indicate a high-risk contagious outbreak.");
        c1.setPossibleDiseasesJson(objectMapper.writeValueAsString(List.of(
                Map.of("name", "Lumpy Skin Disease", "confidence", "High", "action", "Strict quarantine, fly vector control, antipyretic administration under vet supervision")
        )));
        c1.setAssignedVet(drRajesh);
        c1.setStatus(CaseStatus.REFERRED);
        c1.setReportedAt(Instant.now().minus(1, ChronoUnit.DAYS));
        caseReportRepository.save(c1);

        // Case 2: Foot and Mouth Disease (FMD) - HIGH
        Animal a2 = new Animal();
        a2.setSpecies("buffalo");
        a2.setBreed("Murrah");
        a2.setAgeMonths(48);
        a2.setOwnerName("Baldev Singh");
        a2.setOwnerPhone("9812345678");
        a2.setVillage("Karnal");
        a2.setVaccinated(false);
        a2 = animalRepository.save(a2);

        CaseReport c2 = new CaseReport();
        c2.setAnimal(a2);
        c2.setVillage("Karnal");
        c2.setSymptoms(List.of("excessive_salivation", "mouth_blisters", "lameness", "fever"));
        c2.setDaysSinceOnset(2);
        c2.setNearbyActiveCases(3);
        c2.setLatitude(29.6857);
        c2.setLongitude(76.9905);
        c2.setRiskScore(84.0);
        c2.setRiskLevel(RiskLevel.HIGH);
        c2.setFlaggedSymptoms(List.of("mouth_blisters", "excessive_salivation", "lameness"));
        c2.setRecommendation("Isolate animal immediately. Apply mild antiseptic mouthwash (boroglycerine) and foot dip while awaiting assigned veterinarian.");
        c2.setExplanation("Vesicular lesions on oral mucosa and interdigital space with hypersalivation strongly correlate with acute Foot and Mouth Disease.");
        c2.setPossibleDiseasesJson(objectMapper.writeValueAsString(List.of(
                Map.of("name", "Foot and Mouth Disease (FMD)", "confidence", "High", "action", "Antiseptic foot wash, soft diet, immediate ring vaccination in 5km radius")
        )));
        c2.setAssignedVet(drSunita);
        c2.setStatus(CaseStatus.REFERRED);
        c2.setReportedAt(Instant.now().minus(2, ChronoUnit.DAYS));
        caseReportRepository.save(c2);

        // Case 3: Bovine Mastitis - MEDIUM
        Animal a3 = new Animal();
        a3.setSpecies("cattle");
        a3.setBreed("Sahiwal");
        a3.setAgeMonths(60);
        a3.setOwnerName("Gopal Yadav");
        a3.setOwnerPhone("9765432109");
        a3.setVillage("Anand");
        a3.setVaccinated(true);
        a3 = animalRepository.save(a3);

        CaseReport c3 = new CaseReport();
        c3.setAnimal(a3);
        c3.setVillage("Anand");
        c3.setSymptoms(List.of("udder_swelling", "abnormal_milk", "fever"));
        c3.setDaysSinceOnset(1);
        c3.setNearbyActiveCases(1);
        c3.setLatitude(22.5645);
        c3.setLongitude(72.9289);
        c3.setRiskScore(58.0);
        c3.setRiskLevel(RiskLevel.MEDIUM);
        c3.setFlaggedSymptoms(List.of("udder_swelling", "abnormal_milk"));
        c3.setRecommendation("Perform strip cup test and California Mastitis Test (CMT). Maintain strict milking hygiene and consult vet for intramammary infusion.");
        c3.setExplanation("Acute udder inflammation with clotted milk consistency indicates localized bacterial mastitis.");
        c3.setPossibleDiseasesJson(objectMapper.writeValueAsString(List.of(
                Map.of("name", "Clinical Mastitis", "confidence", "Medium-High", "action", "Complete milking out, cold fomentation, vet prescribed antibiotic therapy")
        )));
        c3.setStatus(CaseStatus.ASSESSED);
        c3.setReportedAt(Instant.now().minus(3, ChronoUnit.DAYS));
        caseReportRepository.save(c3);

        // Case 4: Goat Pox / Orf - HIGH
        Animal a4 = new Animal();
        a4.setSpecies("goat");
        a4.setBreed("Beetal");
        a4.setAgeMonths(14);
        a4.setOwnerName("Kisanrao More");
        a4.setOwnerPhone("9988776655");
        a4.setVillage("Pune Rural");
        a4.setVaccinated(false);
        a4 = animalRepository.save(a4);

        CaseReport c4 = new CaseReport();
        c4.setAnimal(a4);
        c4.setVillage("Pune Rural");
        c4.setSymptoms(List.of("skin_nodules", "mouth_blisters", "discharge_eyes", "loss_of_appetite"));
        c4.setDaysSinceOnset(4);
        c4.setNearbyActiveCases(2);
        c4.setLatitude(18.5300);
        c4.setLongitude(73.8600);
        c4.setRiskScore(76.0);
        c4.setRiskLevel(RiskLevel.HIGH);
        c4.setFlaggedSymptoms(List.of("mouth_blisters", "skin_nodules"));
        c4.setRecommendation("Apply soothing antiseptic ointment on oral lesions. Prevent crust detachment and refer to local veterinary officer.");
        c4.setExplanation("Erosive labial scabs and ocular discharge in small ruminants indicate Capripoxvirus or Parapoxvirus manifestation.");
        c4.setPossibleDiseasesJson(objectMapper.writeValueAsString(List.of(
                Map.of("name", "Goat Pox / Contagious Ecthyma", "confidence", "High", "action", "Supportive antiseptic dressing, herd isolation, ring vaccination")
        )));
        c4.setAssignedVet(drAmit);
        c4.setStatus(CaseStatus.REFERRED);
        c4.setReportedAt(Instant.now().minus(1, ChronoUnit.DAYS));
        caseReportRepository.save(c4);

        // Case 5: Mild Digestive Indigestion - LOW (Resolved)
        Animal a5 = new Animal();
        a5.setSpecies("cattle");
        a5.setBreed("Crossbred HF");
        a5.setAgeMonths(24);
        a5.setOwnerName("Surendra Verma");
        a5.setOwnerPhone("9823456789");
        a5.setVillage("Bareilly");
        a5.setVaccinated(true);
        a5 = animalRepository.save(a5);

        CaseReport c5 = new CaseReport();
        c5.setAnimal(a5);
        c5.setVillage("Bareilly");
        c5.setSymptoms(List.of("mild_bloat", "reduced_rumination"));
        c5.setDaysSinceOnset(1);
        c5.setNearbyActiveCases(0);
        c5.setLatitude(28.3900);
        c5.setLongitude(79.4300);
        c5.setRiskScore(25.0);
        c5.setRiskLevel(RiskLevel.LOW);
        c5.setFlaggedSymptoms(List.of());
        c5.setRecommendation("Provide light exercise, withhold grain concentrate for 12 hours, offer fresh green grass and digestive carminative mixture.");
        c5.setExplanation("Mild simple indigestion without systemic pyrexia or mucosal congestion.");
        c5.setPossibleDiseasesJson(objectMapper.writeValueAsString(List.of(
                Map.of("name", "Simple Indigestion / Tympany", "confidence", "Moderate", "action", "Carminative mixture, oral probiotics, dietary adjustment")
        )));
        c5.setStatus(CaseStatus.RESOLVED);
        c5.setReportedAt(Instant.now().minus(5, ChronoUnit.DAYS));
        caseReportRepository.save(c5);

        // Seed Hotspot Alerts
        HotspotAlert h1 = new HotspotAlert();
        h1.setVillage("Rampur");
        h1.setActiveCaseCount(4);
        h1.setTriggeredAt(Instant.now().minus(1, ChronoUnit.DAYS));
        hotspotAlertRepository.save(h1);

        HotspotAlert h2 = new HotspotAlert();
        h2.setVillage("Karnal");
        h2.setActiveCaseCount(3);
        h2.setTriggeredAt(Instant.now().minus(2, ChronoUnit.DAYS));
        hotspotAlertRepository.save(h2);
    }
}
