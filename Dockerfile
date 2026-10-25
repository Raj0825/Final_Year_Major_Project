# Stage 1: Build the Spring Boot application using Maven
FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /app

# Copy pom.xml and source code
COPY pom.xml .
COPY src ./src

# Build package without running tests
RUN mvn clean package -DskipTests

# Stage 2: Run with lightweight JRE 17
FROM eclipse-temurin:17-jre-jammy
WORKDIR /app

# Copy the built jar file
COPY --from=build /app/target/*.jar app.jar

# Expose standard port
EXPOSE 8080

# Run the Spring Boot application
ENTRYPOINT ["java", "-jar", "app.jar"]
