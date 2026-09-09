# The API image.
#
# Two stages so the runtime carries a JRE and one jar rather than Maven, a JDK and the
# whole dependency cache. The dependency layer is resolved before the source is copied, so
# editing a Java file rebuilds in seconds instead of re-downloading Spring.
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build

COPY pom.xml ./
RUN mvn -B -q dependency:go-offline

COPY src ./src
RUN mvn -B -DskipTests package

# ------------------------------------------------------------------ #
# Development                                                        #
# ------------------------------------------------------------------ #
# The dev stack's target: Maven with the dependencies already resolved, running against a
# bind-mounted source tree so a Java change is a restart rather than a rebuild. devtools is
# on the classpath, so recompiling into `target/classes` reloads the running application.
FROM maven:3.9-eclipse-temurin-21 AS dev
WORKDIR /app
ENV LC_ALL=en_US.UTF-8
EXPOSE 8080
CMD ["mvn", "-B", "-DskipTests", "spring-boot:run"]

FROM eclipse-temurin:21-jre AS runtime
WORKDIR /app

# Not root. A web service that is compromised should not also own its filesystem.
RUN groupadd --system --gid 1001 weadk \
 && useradd --system --uid 1001 --gid weadk weadk
USER weadk

COPY --from=build --chown=weadk:weadk /build/target/*.jar /app/app.jar

EXPOSE 8080

# Container-aware by default on 21, so the heap follows the memory limit rather than the
# host's total. Only the bits the JVM does not infer are set here.
ENV JAVA_TOOL_OPTIONS="-XX:+ExitOnOutOfMemoryError -Djava.security.egd=file:/dev/./urandom"

HEALTHCHECK --interval=15s --timeout=3s --start-period=45s --retries=5 \
  CMD ["sh", "-c", "curl -fsS http://localhost:8080/actuator/health/readiness || exit 1"]

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
