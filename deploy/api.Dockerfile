# The API image.
#
# Two stages so the runtime carries a JRE and one jar rather than Gradle, a JDK and the
# whole dependency cache. The dependency layer is resolved before the source is copied, so
# editing a Java file rebuilds in seconds instead of re-downloading Spring.
#
# The base image is a plain JDK rather than a Gradle image: the wrapper pins the Gradle
# version and verifies its checksum, so a Gradle baked into the base would be a second,
# unused copy that could disagree with `gradle-wrapper.properties`.
FROM eclipse-temurin:21-jdk AS build
WORKDIR /build

# The wrapper and the build definition first, on their own layer. Docker reuses it as long
# as none of these change, which is what keeps a source edit off the dependency download.
COPY gradlew ./
COPY gradle ./gradle
COPY settings.gradle.kts build.gradle.kts gradle.properties ./

# Resolve into the image. `--no-daemon` because a build container is used once, and
# GRADLE_USER_HOME is pinned so the cache lands somewhere the next stage can be told about.
ENV GRADLE_USER_HOME=/build/.gradle
RUN ./gradlew --no-daemon dependencies --configuration runtimeClasspath > /dev/null

COPY src ./src
RUN ./gradlew --no-daemon -x test bootJar

# ------------------------------------------------------------------ #
# Development                                                        #
# ------------------------------------------------------------------ #
# The dev stack's target: Gradle with the dependencies already resolved, running against a
# bind-mounted source tree so a Java change is a restart rather than a rebuild. devtools is
# on the classpath, so recompiling into `build/classes` reloads the running application.
#
# It inherits the warmed GRADLE_USER_HOME from the build stage, so `bootRun` starts without
# re-resolving. The source is not copied in — compose mounts it over /app.
FROM eclipse-temurin:21-jdk AS dev
WORKDIR /app
ENV LC_ALL=en_US.UTF-8
ENV GRADLE_USER_HOME=/home/gradle-cache
COPY --from=build /build/.gradle /home/gradle-cache
EXPOSE 8080
CMD ["./gradlew", "--no-daemon", "-x", "test", "bootRun"]

FROM eclipse-temurin:21-jre AS runtime
WORKDIR /app

# Not root. A web service that is compromised should not also own its filesystem.
RUN groupadd --system --gid 1001 weadk \
 && useradd --system --uid 1001 --gid weadk weadk
USER weadk

# One jar, because the plain-jar task is disabled in build.gradle.kts — otherwise this glob
# would match two files and pick one at random.
COPY --from=build --chown=weadk:weadk /build/build/libs/*.jar /app/app.jar

EXPOSE 8080

# Container-aware by default on 21, so the heap follows the memory limit rather than the
# host's total. Only the bits the JVM does not infer are set here.
ENV JAVA_TOOL_OPTIONS="-XX:+ExitOnOutOfMemoryError -Djava.security.egd=file:/dev/./urandom"

HEALTHCHECK --interval=15s --timeout=3s --start-period=45s --retries=5 \
  CMD ["sh", "-c", "curl -fsS http://localhost:8080/actuator/health/readiness || exit 1"]

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
