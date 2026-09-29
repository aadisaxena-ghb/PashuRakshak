// risk_engine.cpp
//
// LivestockGuard risk-scoring engine.
//
// Why this lives in C++ rather than the Java service: this routine runs on
// every field report, potentially in batches when the sync queue drains
// after a village comes back online, and it's pure numeric/string logic
// with no need for the JVM or a database connection. Keeping it as a small,
// dependency-free native binary means the Java backend can shell out to it
// (see RiskAssessmentService.java) and get a deterministic, easily unit-
// tested answer back in microseconds.
//
// Protocol: reads one JSON object from stdin, writes one JSON object to
// stdout, exits 0 on success. No external JSON library is used (the
// environment this ships to may not have one available), so parsing below
// is a small hand-rolled reader built specifically for the fixed shape of
// a CaseReport. It is not a general-purpose JSON parser.
//
// Build:
//   g++ -O2 -std=c++17 -o risk_engine risk_engine.cpp
//
// Example:
//   echo '{"species":"cattle","ageMonths":24,"vaccinated":true,
//          "daysSinceOnset":2,"nearbyActiveCases":3,
//          "symptoms":["fever","nasal_discharge","lameness"]}' | ./risk_engine

#include <iostream>
#include <sstream>
#include <string>
#include <vector>
#include <map>
#include <cmath>
#include <algorithm>
#include <stdexcept>

// ---------------------------------------------------------------------------
// Minimal JSON reading helpers (object of known keys only)
// ---------------------------------------------------------------------------

struct JsonCursor {
    const std::string& s;
    size_t i = 0;
    explicit JsonCursor(const std::string& src) : s(src) {}

    void skipWs() { while (i < s.size() && std::isspace((unsigned char)s[i])) i++; }

    bool eof() const { return i >= s.size(); }

    char peek() { skipWs(); return eof() ? '\0' : s[i]; }

    void expect(char c) {
        skipWs();
        if (eof() || s[i] != c) {
            throw std::runtime_error(std::string("Expected '") + c + "' in input JSON");
        }
        i++;
    }

    std::string parseString() {
        expect('"');
        std::string out;
        while (!eof() && s[i] != '"') {
            if (s[i] == '\\' && i + 1 < s.size()) {
                i++;
                switch (s[i]) {
                    case 'n': out += '\n'; break;
                    case 't': out += '\t'; break;
                    case '"': out += '"'; break;
                    case '\\': out += '\\'; break;
                    default: out += s[i];
                }
            } else {
                out += s[i];
            }
            i++;
        }
        expect('"');
        return out;
    }

    double parseNumber() {
        skipWs();
        size_t start = i;
        while (!eof() && (std::isdigit((unsigned char)s[i]) || s[i] == '-' || s[i] == '.' || s[i] == '+' || s[i] == 'e' || s[i] == 'E')) i++;
        return std::stod(s.substr(start, i - start));
    }

    bool parseBool() {
        skipWs();
        if (s.compare(i, 4, "true") == 0) { i += 4; return true; }
        if (s.compare(i, 5, "false") == 0) { i += 5; return false; }
        throw std::runtime_error("Expected boolean in input JSON");
    }

    std::vector<std::string> parseStringArray() {
        std::vector<std::string> out;
        expect('[');
        skipWs();
        if (peek() == ']') { i++; return out; }
        while (true) {
            skipWs();
            out.push_back(parseString());
            skipWs();
            if (peek() == ',') { i++; continue; }
            break;
        }
        expect(']');
        return out;
    }
};

struct CaseReport {
    std::string species = "cattle";
    double ageMonths = 12;
    bool vaccinated = false;
    double daysSinceOnset = 0;
    double nearbyActiveCases = 0;
    std::vector<std::string> symptoms;
};

CaseReport parseCaseReport(const std::string& json) {
    CaseReport report;
    JsonCursor c(json);
    c.expect('{');
    c.skipWs();
    if (c.peek() == '}') { c.i++; return report; }

    while (true) {
        c.skipWs();
        std::string key = c.parseString();
        c.expect(':');
        c.skipWs();

        if (key == "species") report.species = c.parseString();
        else if (key == "ageMonths") report.ageMonths = c.parseNumber();
        else if (key == "vaccinated") report.vaccinated = c.parseBool();
        else if (key == "daysSinceOnset") report.daysSinceOnset = c.parseNumber();
        else if (key == "nearbyActiveCases") report.nearbyActiveCases = c.parseNumber();
        else if (key == "symptoms") report.symptoms = c.parseStringArray();
        else {
            // Unknown field: skip its value defensively so the engine
            // doesn't break if the Java side adds a field later.
            char p = c.peek();
            if (p == '"') c.parseString();
            else if (p == '[') c.parseStringArray();
            else if (p == 't' || p == 'f') c.parseBool();
            else c.parseNumber();
        }

        c.skipWs();
        if (c.peek() == ',') { c.i++; continue; }
        break;
    }
    c.expect('}');
    return report;
}

// ---------------------------------------------------------------------------
// Scoring model
//
// This is a deliberately transparent, explainable weighted-rule model, not
// a black-box classifier: field workers and vets need to trust and audit
// why a case was flagged. Weights are illustrative starting points for the
// prototype and are the first thing a veterinary domain expert should tune.
// ---------------------------------------------------------------------------

static const std::map<std::string, double> SYMPTOM_WEIGHTS = {
    {"fever",                0.22},
    {"nasal_discharge",      0.18},
    {"loss_of_appetite",     0.12},
    {"lameness",             0.15},
    {"diarrhea",             0.20},
    {"skin_lesions",         0.24},
    {"labored_breathing",    0.28},
    {"sudden_death_nearby",  0.35},
    {"excessive_drooling",   0.19},
    {"reduced_milk_yield",   0.10},
    {"reduced_egg_production", 0.10},
};

static const std::map<std::string, double> SPECIES_MULTIPLIER = {
    {"cattle", 1.00},
    {"buffalo", 1.00},
    {"goat", 0.95},
    {"sheep", 0.95},
    {"poultry", 1.10}, // faster outbreak spread in flocks
    {"pig", 1.05},
};

struct RiskResult {
    double score;         // 0.0 - 1.0
    std::string level;    // LOW / MEDIUM / HIGH / CRITICAL
    std::vector<std::string> flaggedSymptoms;
    std::string recommendation;
    std::string explanation;
};

RiskResult assess(const CaseReport& r) {
    RiskResult result;
    double score = 0.0;
    std::ostringstream why;

    for (const auto& sym : r.symptoms) {
        auto it = SYMPTOM_WEIGHTS.find(sym);
        double w = (it != SYMPTOM_WEIGHTS.end()) ? it->second : 0.08; // unknown symptom: small default weight
        score += w;
        if (w >= 0.18) result.flaggedSymptoms.push_back(sym);
    }

    double speciesMult = 1.0;
    auto sIt = SPECIES_MULTIPLIER.find(r.species);
    if (sIt != SPECIES_MULTIPLIER.end()) speciesMult = sIt->second;
    score *= speciesMult;

    // Untreated duration compounds risk, capped so it doesn't dominate.
    double durationBoost = std::min(r.daysSinceOnset * 0.03, 0.20);
    score += durationBoost;

    // Nearby active cases signal a possible outbreak, not just one sick animal.
    double outbreakBoost = std::min(r.nearbyActiveCases * 0.05, 0.25);
    score += outbreakBoost;

    // Vaccination lowers, but never zeroes out, risk.
    if (r.vaccinated) score *= 0.85;

    // Young or very old animals are more vulnerable.
    if (r.ageMonths < 6 || r.ageMonths > 96) score *= 1.10;

    score = std::max(0.0, std::min(1.0, score));
    result.score = score;

    if (score >= 0.75) {
        result.level = "CRITICAL";
        result.recommendation = "Refer to veterinarian immediately and isolate the animal.";
    } else if (score >= 0.50) {
        result.level = "HIGH";
        result.recommendation = "Refer to veterinarian within 24 hours.";
    } else if (score >= 0.25) {
        result.level = "MEDIUM";
        result.recommendation = "Monitor closely and re-check in 48 hours; contact vet if symptoms worsen.";
    } else {
        result.level = "LOW";
        result.recommendation = "No immediate action needed; continue routine observation.";
    }

    why << "Base symptom load contributed the largest share of the score";
    if (r.nearbyActiveCases > 0) why << ", raised further by " << (int)r.nearbyActiveCases << " active case(s) reported nearby";
    if (r.vaccinated) why << ", partially offset by vaccination status";
    result.explanation = why.str();

    return result;
}

// ---------------------------------------------------------------------------
// Disease symptom-matching
//
// This is a differential-diagnosis AID, not a diagnosis: it compares
// reported symptoms against known symptom profiles for common Indian
// livestock diseases and reports how well each matches, restricted to
// diseases that occur in the reported species. It deliberately stays at
// "possible matches with a percentage", not a single confident answer,
// because that's the honest limit of a symptom checklist without lab
// tests or a physical exam.
// ---------------------------------------------------------------------------

struct DiseaseProfile {
    std::string key;
    std::string name;
    std::vector<std::string> symptoms;
    std::vector<std::string> species; // which species this disease occurs in
    std::string note;
};

static const std::vector<DiseaseProfile> DISEASE_DB = {
    {"fmd", "Foot-and-Mouth Disease (FMD)",
     {"fever", "loss_of_appetite", "excessive_drooling", "lameness"},
     {"cattle", "buffalo", "goat", "sheep", "pig"},
     "Highly contagious viral disease; notifiable in most states."},

    {"lsd", "Lumpy Skin Disease (LSD)",
     {"fever", "skin_lesions", "loss_of_appetite", "reduced_milk_yield"},
     {"cattle", "buffalo"},
     "Viral disease causing nodular skin lesions; vaccine-preventable."},

    {"ppr", "Peste des Petits Ruminants (PPR)",
     {"fever", "diarrhea", "nasal_discharge", "loss_of_appetite", "labored_breathing"},
     {"goat", "sheep"},
     "Highly fatal viral disease of small ruminants; vaccine-preventable."},

    {"hs", "Hemorrhagic Septicemia (HS)",
     {"fever", "labored_breathing", "sudden_death_nearby", "loss_of_appetite"},
     {"cattle", "buffalo"},
     "Acute bacterial disease, can progress and kill within hours."},

    {"bq", "Black Quarter (BQ)",
     {"fever", "lameness", "sudden_death_nearby"},
     {"cattle", "buffalo", "sheep", "goat"},
     "Acute bacterial disease affecting muscle; often fatal without prompt treatment."},

    {"mastitis", "Mastitis",
     {"reduced_milk_yield", "fever"},
     {"cattle", "buffalo", "goat", "sheep"},
     "Udder infection; check for swelling, heat, or abnormal milk alongside these signs."},

    {"newcastle", "Newcastle Disease",
     {"labored_breathing", "diarrhea", "sudden_death_nearby", "loss_of_appetite", "reduced_egg_production"},
     {"poultry"},
     "Highly contagious viral disease of poultry with high flock mortality."},

    {"avian_influenza", "Avian Influenza",
     {"labored_breathing", "sudden_death_nearby", "loss_of_appetite", "fever", "reduced_egg_production"},
     {"poultry"},
     "Notifiable disease; report suspected cases to the local veterinary authority immediately."},

    {"swine_fever", "Classical Swine Fever",
     {"fever", "loss_of_appetite", "diarrhea", "skin_lesions", "sudden_death_nearby"},
     {"pig"},
     "Highly contagious viral disease of pigs; vaccine-preventable."},

    {"anthrax", "Anthrax",
     {"sudden_death_nearby", "fever", "labored_breathing"},
     {"cattle", "buffalo", "goat", "sheep", "pig"},
     "Zoonotic and notifiable. Do not open or handle a carcass suspected of anthrax."},

    {"enterotoxemia", "Enterotoxemia",
     {"diarrhea", "sudden_death_nearby", "loss_of_appetite"},
     {"goat", "sheep"},
     "Sudden-onset bacterial toxin disease, often in well-fed young animals."},

    {"brucellosis", "Brucellosis",
     {"reduced_milk_yield", "loss_of_appetite"},
     {"cattle", "buffalo", "goat", "sheep"},
     "Chronic zoonotic disease; often also causes abortion, which isn't in this symptom list."},
};

struct DiseaseMatch {
    std::string key;
    std::string name;
    int matchPercent;
    std::string note;
};

std::vector<DiseaseMatch> matchDiseases(const std::string& species, const std::vector<std::string>& reportedSymptoms) {
    std::vector<DiseaseMatch> matches;

    for (const auto& disease : DISEASE_DB) {
        bool speciesApplies = std::find(disease.species.begin(), disease.species.end(), species) != disease.species.end();
        if (!speciesApplies) continue;

        int overlap = 0;
        for (const auto& sym : disease.symptoms) {
            if (std::find(reportedSymptoms.begin(), reportedSymptoms.end(), sym) != reportedSymptoms.end()) {
                overlap++;
            }
        }
        if (overlap == 0) continue;

        int percent = (int)std::round(100.0 * overlap / disease.symptoms.size());
        matches.push_back({disease.key, disease.name, percent, disease.note});
    }

    std::sort(matches.begin(), matches.end(), [](const DiseaseMatch& a, const DiseaseMatch& b) {
        return a.matchPercent > b.matchPercent;
    });
    if (matches.size() > 3) matches.resize(3);
    return matches;
}

std::string jsonEscape(const std::string& in) {
    std::string out;
    for (char c : in) {
        if (c == '"' || c == '\\') out += '\\';
        out += c;
    }
    return out;
}

int main() {
    std::ostringstream buf;
    buf << std::cin.rdbuf();
    std::string input = buf.str();

    try {
        CaseReport report = parseCaseReport(input);
        RiskResult result = assess(report);
        std::vector<DiseaseMatch> diseases = matchDiseases(report.species, report.symptoms);

        std::cout << "{"
                  << "\"riskScore\":" << result.score << ","
                  << "\"riskLevel\":\"" << result.level << "\","
                  << "\"flaggedSymptoms\":[";
        for (size_t i = 0; i < result.flaggedSymptoms.size(); i++) {
            if (i) std::cout << ",";
            std::cout << "\"" << jsonEscape(result.flaggedSymptoms[i]) << "\"";
        }
        std::cout << "],"
                  << "\"recommendation\":\"" << jsonEscape(result.recommendation) << "\","
                  << "\"explanation\":\"" << jsonEscape(result.explanation) << "\","
                  << "\"possibleDiseases\":[";
        for (size_t i = 0; i < diseases.size(); i++) {
            if (i) std::cout << ",";
            std::cout << "{"
                      << "\"key\":\"" << jsonEscape(diseases[i].key) << "\","
                      << "\"name\":\"" << jsonEscape(diseases[i].name) << "\","
                      << "\"matchPercent\":" << diseases[i].matchPercent << ","
                      << "\"note\":\"" << jsonEscape(diseases[i].note) << "\""
                      << "}";
        }
        std::cout << "]"
                  << "}" << std::endl;
        return 0;
    } catch (const std::exception& ex) {
        std::cerr << "{\"error\":\"" << jsonEscape(ex.what()) << "\"}" << std::endl;
        return 1;
    }
}
