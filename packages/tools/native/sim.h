/*
 * Bit-exact C port of the per-step simulation as the optimal-run search sees it
 * (packages/tools/src/optimal/engine.ts): a state is a row of SIM_STATE_INTS int32 values,
 * and sim_expand produces exactly the successor rows, presses and finish flags that
 * `Engine.expand(row, 0, out, 0, succ)` produces with the default 16 presses.
 *
 * The data blob (level, tables, sine, moves, live-buffer masks, start row) is written by
 * packages/tools/src/optimal/exportNative.ts. A loaded SimData is read-only: any number of
 * threads may expand with one SimData at the same time.
 */
#ifndef PARAPET_SIM_H
#define PARAPET_SIM_H

#include <stddef.h>
#include <stdint.h>

/** Ints per state row (runner 44, four probes of 12, the rules' mask). */
#define SIM_STATE_INTS 93
/** At most this many successors per expansion (one per press). */
#define SIM_MAX_SUCC 16

typedef struct SimData SimData;

/** Loads a blob written by exportNative.ts. On failure returns NULL and writes `err`. */
SimData *sim_load(const int32_t *blob, size_t count, char *err, size_t errlen);
SimData *sim_load_file(const char *path, char *err, size_t errlen);
void sim_free(SimData *d);

/** The start row of the run (`Engine.start`). */
void sim_start(const SimData *d, int32_t *row);
/** Drops the buffer bits the row's move can never read (`Engine.canon`). */
void sim_canon(const SimData *d, int32_t *row);

/**
 * Every distinct successor of `row`, written one row each into `out` (room for
 * SIM_MAX_SUCC rows), with the index into the 16 presses in `press` and 1 in `finished` when
 * the run finished on that step. Returns the number of successors. When `steps` is not NULL,
 * the number of simulated steps is added to it.
 */
int sim_expand(const SimData *d, const int32_t *row, int32_t *out, uint8_t *press,
               uint8_t *finished, uint64_t *steps);

/** Press bits of press index i (subsets of UP=1, DOWN=2, FORWARD=16, BACK=32). */
extern const int32_t SIM_PRESSES[16];

#endif
