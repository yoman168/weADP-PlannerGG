/*
 * The API is a single Gradle build, deliberately not part of the pnpm workspace above it.
 *
 * `rootProject.name` sets the jar name, which the Dockerfile and `bootRun` both depend on:
 * build/libs/we-adk-api-<version>.jar.
 */
rootProject.name = "we-adk-api"
