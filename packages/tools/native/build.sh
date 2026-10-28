#!/usr/bin/env bash
# Builds the native simulation's test and benchmark driver into packages/tools/native/build/.
# Needs gcc (MinGW-w64 on Windows). Extra flags can be passed in CFLAGS.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$here/build"
gcc -std=c11 -O2 -march=native -Wall -Wextra -Wno-unused-parameter ${CFLAGS:-} \
  -o "$here/build/simtest" "$here/sim.c" "$here/simtest.c"
echo "built $here/build/simtest"
