/*
 * Test and benchmark driver for sim.c.
 *
 *   simtest diff  <data.bin> <cases.bin>             compare against the TS engine's expansions
 *   simtest bench <data.bin> <cases.bin> [seconds]   expansions and steps per second
 *
 * A cases file is a sequence of records, all little-endian int32:
 *   row[SIM_STATE_INTS], n, then n times: successor row[SIM_STATE_INTS], press, finished
 * as written by packages/tools/src/optimal/nativeDiff.ts. `bench` uses only the input rows.
 *
 * Both print one `key=value` summary line on stdout; `diff` exits with 1 on any mismatch.
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#include "sim.h"

#define S SIM_STATE_INTS

static int32_t *readAll(const char *path, size_t *count) {
  FILE *f = fopen(path, "rb");
  if (!f) {
    fprintf(stderr, "cannot open %s\n", path);
    exit(2);
  }
  fseek(f, 0, SEEK_END);
  long size = ftell(f);
  fseek(f, 0, SEEK_SET);
  int32_t *buf = malloc((size_t)size + 4);
  if (!buf || fread(buf, 1, (size_t)size, f) != (size_t)size) {
    fprintf(stderr, "cannot read %s\n", path);
    exit(2);
  }
  fclose(f);
  *count = (size_t)size / 4;
  return buf;
}

static double now(void) {
  struct timespec ts;
  timespec_get(&ts, TIME_UTC);
  return (double)ts.tv_sec + (double)ts.tv_nsec * 1e-9;
}

static int diff(const SimData *d, const int32_t *c, size_t count) {
  size_t pos = 0;
  uint64_t expansions = 0, successors = 0, mismatches = 0, steps = 0;
  int32_t out[SIM_MAX_SUCC * S];
  uint8_t press[SIM_MAX_SUCC], fin[SIM_MAX_SUCC];
  int reported = 0;
  while (pos < count) {
    if (pos + S + 1 > count) {
      fprintf(stderr, "truncated record at %zu\n", pos);
      return 2;
    }
    const int32_t *row = c + pos;
    int n = c[pos + S];
    pos += S + 1;
    if (n < 0 || n > SIM_MAX_SUCC || pos + (size_t)n * (S + 2) > count) {
      fprintf(stderr, "bad record at %zu\n", pos);
      return 2;
    }
    int got = sim_expand(d, row, out, press, fin, &steps);
    int bad = got != n;
    for (int k = 0; k < n && !bad; k++) {
      const int32_t *e = c + pos + (size_t)k * (S + 2);
      if (memcmp(e, out + k * S, S * sizeof(int32_t)) != 0 || e[S] != press[k] ||
          e[S + 1] != fin[k])
        bad = 1;
    }
    if (bad) {
      mismatches++;
      if (reported < 5) {
        reported++;
        fprintf(stderr, "mismatch at expansion %llu: expected %d successors, got %d\n",
                (unsigned long long)expansions, n, got);
        for (int k = 0; k < n && k < got; k++) {
          const int32_t *e = c + pos + (size_t)k * (S + 2);
          for (int i = 0; i < S; i++)
            if (e[i] != out[k * S + i])
              fprintf(stderr, "  succ %d field %d: expected %d, got %d\n", k, i, e[i],
                      out[k * S + i]);
          if (e[S] != press[k] || e[S + 1] != fin[k])
            fprintf(stderr, "  succ %d press/finished: expected %d/%d, got %d/%d\n", k, e[S],
                    e[S + 1], press[k], fin[k]);
        }
        fprintf(stderr, "  row:");
        for (int i = 0; i < S; i++) fprintf(stderr, " %d", row[i]);
        fprintf(stderr, "\n");
      }
    }
    expansions++;
    successors += (uint64_t)n;
    pos += (size_t)n * (S + 2);
  }
  printf("expansions=%llu successors=%llu steps=%llu mismatches=%llu\n",
         (unsigned long long)expansions, (unsigned long long)successors,
         (unsigned long long)steps, (unsigned long long)mismatches);
  return mismatches ? 1 : 0;
}

static int bench(const SimData *d, const int32_t *c, size_t count, double seconds) {
  /* Collect the input rows. */
  size_t cap = 1024, nrows = 0;
  int32_t *rows = malloc(cap * S * sizeof(int32_t));
  for (size_t pos = 0; pos + S + 1 <= count;) {
    if (nrows == cap) {
      cap *= 2;
      rows = realloc(rows, cap * S * sizeof(int32_t));
    }
    memcpy(rows + nrows * S, c + pos, S * sizeof(int32_t));
    nrows++;
    int n = c[pos + S];
    pos += S + 1 + (size_t)n * (S + 2);
  }
  int32_t out[SIM_MAX_SUCC * S];
  uint8_t press[SIM_MAX_SUCC], fin[SIM_MAX_SUCC];
  uint64_t expansions = 0, successors = 0, steps = 0;
  int32_t sink = 0;
  double t0 = now(), t;
  do {
    for (size_t i = 0; i < nrows; i++) {
      int n = sim_expand(d, rows + i * S, out, press, fin, &steps);
      successors += (uint64_t)n;
      sink ^= out[0];
    }
    expansions += nrows;
    t = now() - t0;
  } while (t < seconds);
  printf("rows=%zu expansions=%llu successors=%llu steps=%llu seconds=%.3f "
         "expansions_per_s=%.0f steps_per_s=%.0f sink=%d\n",
         nrows, (unsigned long long)expansions, (unsigned long long)successors,
         (unsigned long long)steps, t, (double)expansions / t, (double)steps / t, sink & 1);
  free(rows);
  return 0;
}

int main(int argc, char **argv) {
  if (argc < 4 || (strcmp(argv[1], "diff") != 0 && strcmp(argv[1], "bench") != 0)) {
    fprintf(stderr, "usage: simtest diff|bench <data.bin> <cases.bin> [seconds]\n");
    return 2;
  }
  char err[256];
  SimData *d = sim_load_file(argv[2], err, sizeof err);
  if (!d) {
    fprintf(stderr, "cannot load %s: %s\n", argv[2], err);
    return 2;
  }
  size_t count;
  int32_t *c = readAll(argv[3], &count);
  int rc = strcmp(argv[1], "diff") == 0
               ? diff(d, c, count)
               : bench(d, c, count, argc > 4 ? atof(argv[4]) : 2.0);
  free(c);
  sim_free(d);
  return rc;
}
