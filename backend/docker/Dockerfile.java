FROM eclipse-temurin:17-jdk

# Use standard Debian/Ubuntu syntax for adduser
RUN useradd -m runner
USER runner

WORKDIR /app

# No specific CMD needed as we override it in docker.ts