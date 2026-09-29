# 🛡️ PashuRakshak — SIH Code Explanation & Jury Q&A Guide

> **Project:** PashuRakshak (Livestock Disease Triage & Early Outbreak Warning System)  
> **Target Audience:** Smart India Hackathon (SIH) Judges, Technical Reviewers, Field Evaluators  

---

## 1. 🏗️ High-Level System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    CLIENT / FIELD DEVICE                     │
│                                                              │
│   React 18 + Vite SPA  (frontend-react/)                     │
│   • Multilingual (English, Hindi, Marathi)                   │
│   • Voice Symptom Dictation (Web Speech API)                │
│   • Multimodal Photo Upload & Leaflet Interactive Maps       │
└──────────────────────────────┬───────────────────────────────┘
                               │  REST API (JSON over HTTP :8080)
                               ▼
┌──────────────────────────────────────────────────────────────┐
│           BACKEND LAYER (Spring Boot 3.3 / Java 17)          │
│                                                              │
│  • Controllers: Cases, Vets, Hotspots, PhotoAnalysis         │
│  • Services:                                                 │
│    ├── RiskAssessmentService ──► Executes Native C++ Engine  │
│    ├── ImageDiagnosisService ──► Google Gemini 2.0 Flash     │
│    ├── GooglePlacesService   ──► OpenStreetMap Overpass API  │
│    └── HotspotService        ──► Village Cluster Analytics   │
│  • Persistence: File-based JPA/H2 Database (Persistent)      │
└──────────────┬───────────────────────────────┬───────────────┘
               │ ProcessBuilder (Subprocess)   │
               ▼                               ▼
     ┌───────────────────┐           ┌───────────────────┐
     │  NATIVE C++ RISK  │           │   GOOGLE GEMINI   │
     │  ENGINE BINARY    │           │   VISION AI API   │
     │  (Deterministic & │           │  (Multimodal Real │
     │  Explainable AI)  │           │  Visual Read)     │
     └───────────────────┘           └───────────────────┘
```

---

## 2. 📂 Key Files & Module Breakdown

| Layer | File / Module | Responsibility |
|---|---|---|
| **Frontend** | `ReportCase.jsx` | Case intake: Species, age, weight, symptoms checklist, voice dictation, photo capture. |
| **Frontend** | `CaseLedger.jsx` | Real-time audit ledger of all reports with risk level filtering (`CRITICAL`, `HIGH`, `MED`, `LOW`). |
| **Frontend** | `VetDesk.jsx` | Doctor triage queue: auto-suggests nearest verified veterinarian by GPS Haversine distance. |
| **Frontend** | `VetLocator.jsx` | Interactive map powered by Leaflet & OpenStreetMap displaying live clinics & national institutes. |
| **Frontend** | `VaccinationGuide.jsx` | Interactive species-wise vaccination schedules & booster timelines. |
| **Frontend** | `translations.js` | Full dictionary in English, Hindi (हिंदी), and Marathi (मराठी). |
| **Backend** | `RiskAssessmentService.java` | Spawns C++ sub-process, feeds JSON on `stdin`, parses risk score & recommendations from `stdout`. |
| **Backend** | `ImageDiagnosisService.java` | Multimodal Google Gemini Vision AI handler for visual lesions & supportive care first-aid. |
| **Backend** | `GooglePlacesService.java` | Zero-dependency nearby vet search querying OpenStreetMap Overpass API + verified database. |
| **Backend** | `HotspotService.java` | Aggregates high-risk cases within a 14-day rolling window to flag village-level disease clusters. |
| **C++ Core** | `cpp-risk-engine/main.cpp` | Ultra-fast rule-based scoring engine computing exact risk percentages, flagged vectors, and reasons. |

---

## 3. 🎯 Top 15 Jury Q&A (Technical & Product Defense)

### Q1: Why did you use a C++ Risk Engine instead of Python/Java?
> **Answer:** 
> 1. **Explainability & Compliance:** Medical & veterinary triage requires deterministic, verifiable decision rules rather than a black-box model that can hallucinate.
> 2. **Ultra-Low Latency & Low Memory:** The C++ binary executes in **< 5 milliseconds** and has zero runtime dependencies, making it capable of running on low-resource edge servers, Raspberry Pi, or local kiosks in rural veterinary dispensaries without needing high-end GPUs.

---

### Q2: What if there is no internet in remote rural areas?
> **Answer:**
> PashuRakshak is designed **offline-first**:
> 1. The C++ Risk Engine runs locally without any cloud connection.
> 2. The database is persistent locally (H2/SQLite).
> 3. AI Photo Diagnosis and Maps have built-in local fallbacks so the field worker can triage immediately and sync to the central cloud ledger once network is restored.

---

### Q3: How does your Disease Outbreak / Hotspot Detection work?
> **Answer:**
> Our `HotspotService` runs an automated spatial-temporal cluster analysis:
> - It inspects reports filed in a rolling **14-day window**.
> - When a single village or block crosses **3 or more HIGH/CRITICAL cases**, a `HotspotAlert` is automatically triggered.
> - This enables district animal husbandry officers to deploy preventive ring-vaccination teams before the disease turns into an epidemic.

---

### Q4: Why Google Gemini for Photo Analysis and how is it used?
> **Answer:**
> We use **Google Gemini 2.0 Flash Vision** in a multimodal pipeline:
> - Field workers upload a photo of the affected area (e.g. skin nodules, oral blisters, leg swelling).
> - Gemini analyzes the visual pixels and returns a structured JSON payload identifying:
>   1. Visible clinical signs
>   2. Potential matched conditions
>   3. Non-prescription supportive first-aid care (e.g. isolation, antiseptic wash)
> - **Guardrail:** It never prescribes restricted antibiotics or dosages, clearly framing all outputs as preliminary triage support rather than an unauthorized prescription.

---

### Q5: How do you handle language barriers for rural farmers?
> **Answer:**
> - The entire application has a **100% linear translation system** across English, Hindi (हिंदी), and Marathi (मराठी).
> - We integrated **Voice Reporting** using the Web Speech API so farmers who cannot type can simply speak into their phone in their mother tongue, and the symptoms are transcribed automatically.

---

### Q6: How does the Automatic Vet Assignment algorithm work?
> **Answer:**
> When a HIGH or CRITICAL case is submitted with GPS coordinates:
> 1. The backend calculates the **Haversine great-circle distance** to all registered veterinary centers.
> 2. The case is automatically routed and prioritized to the closest available veterinarian within 100 km.
> 3. If no registered doctor is in the immediate radius, it fetches real nearby veterinary dispensaries via OpenStreetMap.

---

### Q7: What database are you using, and how does it scale to production?
> **Answer:**
> - In development/demo, we use a file-backed **H2 JPA database** that survives server restarts with zero external setup.
> - For production deployment, Spring Boot's database abstraction allows switching to **PostgreSQL / Google Cloud SQL** by simply changing the JDBC connection string in `application.properties`, with zero code changes.

---

### Q8: What makes PashuRakshak unique compared to existing government portals?
> **Answer:**
> 1. **Instant Offline Triage:** Farmers get an immediate risk rating and first-aid guide within seconds instead of waiting days for a callback.
> 2. **Multimodal Triangulation:** Combines structured checkboxes, voice transcription, and AI vision in one unified report.
> 3. **Proactive Outbreak Warnings:** Focuses on prevention and containment rather than just static record keeping.

---

## 4. ⏱️ 3-Minute Pitch Script for the Stage

* **[0:00 - 0:30] The Problem:** *"Over 70% of India's rural households depend on livestock, yet delayed disease detection causes massive economic losses and epidemic outbreaks like Lumpy Skin Disease and FMD."*
* **[0:30 - 1:00] Solution Demo:** *"PashuRakshak bridges this gap with an AI-assisted field triage app. A farmer opens the app in Hindi, speaks their symptoms, or uploads a photo."*
* **[1:00 - 1:45] Technical Depth:** *"Our hybrid architecture pairs a deterministic C++ Risk Engine for explainable decision support with Google Gemini Vision for preliminary lesion assessment."*
* **[1:45 - 2:30] Triage & Maps:** *"Critical cases trigger immediate automated routing to the nearest veterinarian via our OpenStreetMap engine, while cluster analytics detect village outbreaks in real-time."*
* **[2:30 - 3:00] Impact:** *"PashuRakshak empowers every frontline worker to save animals, protect farmer livelihoods, and build a disease-resilient India."*
