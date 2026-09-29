package com.livestockguard.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.livestockguard.dto.RiskEngineResult;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * Bridges the Java API to the native C++ risk-scoring engine.
 *
 * The engine is a small, dependency-free binary (see cpp-risk-engine/) that
 * reads one JSON case object on stdin and writes one JSON result on stdout.
 * We shell out to it with ProcessBuilder rather than reimplementing the
 * scoring logic in Java, so the scoring rules live in exactly one place and
 * can be unit-tested and tuned independently of the web layer.
 */
@Service
public class RiskAssessmentService {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Path enginePath;

    public RiskAssessmentService(@Value("${livestockguard.risk-engine.path}") String enginePathProperty) {
        Path p = Path.of(enginePathProperty).toAbsolutePath().normalize();
        if (!java.nio.file.Files.exists(p) && java.nio.file.Files.exists(Path.of(p.toString() + ".exe"))) {
            p = Path.of(p.toString() + ".exe");
        }
        this.enginePath = p;
    }

    public RiskEngineResult assess(String species,
                                    Integer ageMonths,
                                    boolean vaccinated,
                                    int daysSinceOnset,
                                    int nearbyActiveCases,
                                    List<String> symptoms) {
        try {
            String inputJson = buildInputJson(species, ageMonths, vaccinated, daysSinceOnset, nearbyActiveCases, symptoms);

            ProcessBuilder pb = new ProcessBuilder(enginePath.toString());
            pb.redirectErrorStream(false);
            Process process = pb.start();

            try (OutputStream stdin = process.getOutputStream()) {
                stdin.write(inputJson.getBytes(StandardCharsets.UTF_8));
                stdin.flush();
            }

            String stdout = readAll(process.getInputStream());
            String stderr = readAll(process.getErrorStream());

            boolean finished = process.waitFor(5, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                throw new RiskEngineException("Risk engine timed out after 5s");
            }
            if (process.exitValue() != 0) {
                throw new RiskEngineException("Risk engine exited with error: " + stderr);
            }

            return objectMapper.readValue(stdout, RiskEngineResult.class);

        } catch (IOException | InterruptedException e) {
            throw new RiskEngineException(
                "Could not run risk engine at " + enginePath +
                ". Build it first with `make` inside cpp-risk-engine/, " +
                "or update livestockguard.risk-engine.path in application.properties.", e);
        }
    }

    private String buildInputJson(String species, Integer ageMonths, boolean vaccinated,
                                   int daysSinceOnset, int nearbyActiveCases,
                                   List<String> symptoms) throws IOException {
        Map<String, Object> input = new LinkedHashMap<>();
        input.put("species", species == null ? "cattle" : species);
        input.put("ageMonths", ageMonths == null ? 12 : ageMonths);
        input.put("vaccinated", vaccinated);
        input.put("daysSinceOnset", daysSinceOnset);
        input.put("nearbyActiveCases", nearbyActiveCases);
        input.put("symptoms", symptoms == null ? List.of() : symptoms);
        return objectMapper.writeValueAsString(input);
    }

    private String readAll(java.io.InputStream in) throws IOException {
        StringBuilder sb = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) sb.append(line);
        }
        return sb.toString();
    }

    public static class RiskEngineException extends RuntimeException {
        public RiskEngineException(String message) { super(message); }
        public RiskEngineException(String message, Throwable cause) { super(message, cause); }
    }
}
