# Stage 1: Build the C++ Risk Engine
FROM alpine:3.18 AS cpp-build
# Install C++ compiler and make
RUN apk add --no-cache build-base

WORKDIR /app/cpp-risk-engine
# Copy the C++ folder
COPY cpp-risk-engine/ .
# Compile the risk_engine
RUN make

# Stage 2: Build the Java Spring Boot App
FROM maven:3.9.5-eclipse-temurin-17 AS java-build
WORKDIR /app/backend-java

# Copy pom.xml and download dependencies first (for faster caching)
COPY backend-java/pom.xml .
RUN mvn dependency:go-offline -B

# Copy the rest of the Java source code and build the JAR
COPY backend-java/src ./src
RUN mvn clean package -DskipTests

# Stage 3: Create the final Runtime Image
FROM eclipse-temurin:17-jre-alpine

# Install libstdc++ which is required to run the compiled C++ binary
RUN apk add --no-cache libstdc++

WORKDIR /app

# Copy the built Java JAR
COPY --from=java-build /app/backend-java/target/*.jar app.jar

# Copy the compiled C++ binary exactly where the Java app expects it: ../cpp-risk-engine/risk_engine
RUN mkdir -p /cpp-risk-engine
COPY --from=cpp-build /app/cpp-risk-engine/risk_engine /cpp-risk-engine/risk_engine

# Create a data directory for the H2 file database
RUN mkdir -p /app/data

# Expose the default Spring Boot port
EXPOSE 8080

# Run the Java application
ENTRYPOINT ["java", "-jar", "app.jar"]
