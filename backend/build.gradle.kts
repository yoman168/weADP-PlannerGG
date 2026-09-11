/*
 * WE-ADK API — projects, rounds, design files, tasks, builds and the Claude bridge.
 *
 * Spring Boot 3.5 on Java 21, Spring MVC served on virtual threads.
 *
 * The Boot plugin's dependency management supplies a version for every Spring, Flyway,
 * Micrometer and Testcontainers artifact below, which is why almost none of them name one.
 * The three that do are outside Boot's BOM, and each is pinned in `gradle.properties` so
 * the version and the reason for it sit together rather than being buried here.
 */
plugins {
    java
    id("org.springframework.boot") version "3.5.16"
    id("io.spring.dependency-management") version "1.1.7"
}

group = "com.weadk"
version = "0.1.0-SNAPSHOT"
description = "WE-ADK API — projects, rounds, design files, tasks, builds and the Claude bridge"

java {
    // A toolchain rather than source/target compatibility: this asks Gradle for a JDK 21 and
    // fails if it cannot find one, instead of silently compiling with whatever JDK happens to
    // be running the build. Docker and CI both provide 21, so nothing is downloaded there.
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

repositories {
    mavenCentral()
}

/**
 * Versions outside Spring Boot's BOM.
 *
 * Read from `gradle.properties` so a dependency bump is one line in a file that holds
 * nothing else, and so the same value is available to tooling that cannot parse Kotlin.
 */
val anthropicVersion: String by project
val springdocVersion: String by project

dependencies {
    // Web: Spring MVC, served on virtual threads (spring.threads.virtual.enabled)
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-validation")

    // Persistence: Spring Data JPA + Postgres + Flyway.
    // Hibernate runs with ddl-auto: validate — Flyway owns the schema, and the migrations
    // in src/main/resources/db/migration are the only thing that may change it.
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.flywaydb:flyway-core")
    implementation("org.flywaydb:flyway-database-postgresql")
    runtimeOnly("org.postgresql:postgresql")

    // Security: stateless JWT resource server
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-oauth2-resource-server")

    // OAuth2: this service issues the tokens as well as validating them
    implementation("org.springframework.boot:spring-boot-starter-oauth2-authorization-server")
    // The sign-in page the authorization server serves. Credentials are typed there and
    // nowhere else, which is the point of the redirect.
    implementation("org.springframework.boot:spring-boot-starter-thymeleaf")

    // Claude
    implementation("com.anthropic:anthropic-java:$anthropicVersion")

    // Operations: Actuator + Micrometer (Prometheus registry)
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    runtimeOnly("io.micrometer:micrometer-registry-prometheus")

    // OpenAPI: the contract the TypeScript client is generated from
    implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:$springdocVersion")

    // Dev. developmentOnly keeps it off the runtime classpath of the built jar, which is
    // what Maven's optional+runtime scope achieved — devtools must never ship.
    developmentOnly("org.springframework.boot:spring-boot-devtools")

    // Test
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.security:spring-security-test")
    testImplementation("org.springframework.boot:spring-boot-testcontainers")
    testImplementation("org.testcontainers:junit-jupiter")
    testImplementation("org.testcontainers:postgresql")
}

tasks.withType<JavaCompile>().configureEach {
    options.compilerArgs.addAll(
        listOf(
            "-Xlint:all",
            // Annotation processors are Boot's own and their notes are not actionable here.
            "-Xlint:-processing",
            // Entities and DTOs are never serialized through Java serialization.
            "-Xlint:-serial",
        ),
    )
    // Keeps parameter names in the bytecode. Spring can bind constructor arguments and
    // @RequestParam without them, but the failures when they are missing are obscure, and
    // springdoc reads them to name the parameters in the generated OpenAPI document.
    options.compilerArgs.add("-parameters")
}

tasks.withType<Test>().configureEach {
    useJUnitPlatform()
    /*
     * The Postgres tests share one Testcontainers instance through
     * `com.weadk.support.WorkspaceDatabase`, so they must not run in parallel JVMs. This is
     * Gradle's default; it is stated because raising it silently breaks the shared container.
     */
    maxParallelForks = 1
    testLogging {
        // A failed assertion is useless without the reason, and Gradle hides it by default.
        exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL
        events("failed")
    }
}

/*
 * No `-plain.jar`.
 *
 * Gradle's own `jar` task produces one alongside Boot's executable jar, so `build/libs/*.jar`
 * would match two files and the Dockerfile's COPY would pick one at random. Nothing consumes
 * this project as a library, so the plain jar has no use.
 */
tasks.named<Jar>("jar") {
    enabled = false
}
