# The J2ME emulator box for reference/emulator/run.mjs: a JDK, a virtual X screen, synthetic
# mouse input and a screen recorder. MicroEmulator itself is not in the image: run.mjs downloads
# its jars into build/jars and mounts them.
FROM eclipse-temurin:17-jdk
RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
     xvfb xdotool ffmpeg x11-utils fonts-dejavu-core \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /work
