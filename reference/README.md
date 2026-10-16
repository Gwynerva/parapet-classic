# reference/ — the original game, documented

Everything we learned about the original **Playman Extreme Running** (Mr. Goodliving / RealNetworks, 2007, J2ME, version 1.0.8, Russian 240×320 build) while reverse-engineering it, plus the tools to reproduce that work.

- `notes/` — formats, move state machine, physics, rendering, modes and data, curiosities and bugs of the original, glossary of obfuscated names, and what the tool-assisted search for Gwynerva's records found (`09-tas.md`).
- `decompiled/` — CFR 0.152 output (`--renamedupmembers`). Not committed; regenerate with `npm run decompile` (needs Java or Docker).
- `oracle/` — headless harness: the original class files run on a plain JVM against J2ME stubs and dump reference traces used by the simulation tests. It runs the obfuscated originals as they are; it does not reconstruct their source.
- `emulator/` — footage of the original on a phone: the jar plays in MicroEmulator (Docker), driven by a script of key presses or by a TAS route, and the recording is laid into a painted Nokia 6300 whose keys light up while they are held (`npm run emulator`). Not part of the game or its tests.

Line numbers in the notes refer to `decompiled/d.java` (10 719 lines). Names such as `int_m`, `boolean_d`, `var_int_arr_I` are the names CFR assigned to the obfuscated members of class `d`; the mapping to our names is in `notes/glossary.md`.
