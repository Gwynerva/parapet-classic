# TAS records

The 24 machine records of Parapet Classic: every level, Flag Hunt and Sprint, 13:31.74 in
total. They are the runs of the TAS film (`packages/classic/dev/film.ts`), the world's first TAS
of Playman Extreme Running.

Each run was found by the TAS search in `packages/tools/src/tas/` under human rules: one key at
a time, at least 3 steps (90 ms) between presses, and no frame-perfect timing: each press may
come one step early or late and the run still finishes, at most 300 ms slower (`constraints` in
each file, `packages/tools/src/tas/constraints.ts`). The simulation is `parapet-sim@0.2.0`, the same as in
release 1.1.0, so the links below play on the live site.

## The inputs

Each JSON file holds the whole run:

- `presses`: every input, as `step:key` pairs. A step is 30 ms of game time, counted from 0
  (the step that consumes the press). The key is one tap of an arrow as seen on screen: `L`,
  `R`, `U` (up) or `D` (down). Nothing else is pressed, and nothing is held.
- `replay`: the same run as a replay code, the one the game's challenge links carry.
- `timeMs`, `steps`, `splitsMs`: the finish time, its length in steps and the time of each
  flag or checkpoint, as the replay produces them.
- `order`: the order the flags are taken in (Flag Hunt).
- `search`: the seed and budget of the search that found it.

`npm run tas -- verify` re-runs every stored run and checks its time and splits.

## The runs

| #   | Level         | Mode      | Time    | Steps | Presses | Inputs                                                       | Replay                                                                                                                                                                                     |
| --- | ------------- | --------- | ------- | ----- | ------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 01  | Mill Brook    | Flag Hunt | 0:14.37 | 479   | 14      | [01-mill-brook-flags.json](01-mill-brook-flags.json)         | [watch](https://gwynerva.github.io/parapet-classic/r/?AnUaDAR50gQKCEd3eW5lcnZhWfAZxZCcI8H4HA9wkgUAoBAyDIN4kA)                                                                              |
| 01  | Mill Brook    | Sprint    | 0:27.99 | 933   | 30      | [01-mill-brook-sprint.json](01-mill-brook-sprint.json)       | [watch](https://gwynerva.github.io/parapet-classic/r/?AnUaDAR50gILCEd3eW5lcnZhJYNg0IdIkGxIA9GIJ0ghICC_SIJQe8GiXi7iDBsXMPwYAMDwyIWKGBQ)                                                     |
| 02  | North Hill    | Flag Hunt | 0:34.53 | 1151  | 37      | [02-north-hill-flags.json](02-north-hill-flags.json)         | [watch](https://gwynerva.github.io/parapet-classic/r/?AnUaMfUCuRQMCEd3eW5lcnZhLIBhzAkIeCwKFuEgh4PA_BgJ8MDBSMMIuKPEqlIWKPwUpQpZpTB8GqUBFpUpLpPpRo_AsA)                                      |
| 02  | North Hill    | Sprint    | 0:28.95 | 965   | 29      | [02-north-hill-sprint.json](02-north-hill-sprint.json)       | [watch](https://gwynerva.github.io/parapet-classic/r/?AnUaMfUCuRINCEd3eW5lcnZhJIggEQBEpTBgODQiUngYUQyJtIMMgFwHDNJkFg2CAyIdJ8KVKNI4)                                                        |
| 03  | Main St.      | Flag Hunt | 0:24.42 | 814   | 29      | [03-main-st-flags.json](03-main-st-flags.json)               | [watch](https://gwynerva.github.io/parapet-classic/r/?AnUaQ_QgNyQOCEd3eW5lcnZhJINhHCEAwyFIOAGCIZEMCAYMiTihhMTwyEIO4sYs4zsPwN4Eg_QQ)                                                        |
| 03  | Main St.      | Sprint    | 0:30.39 | 1013  | 38      | [03-main-st-sprint.json](03-main-st-sprint.json)             | [watch](https://gwynerva.github.io/parapet-classic/r/?AnUaQ_QgNyIPCEd3eW5lcnZhLYJhTo_Byk-lACwMDfBgJBgK4OgEGQPCLTBEGlCk-kSGbSVBSkGDwJBvgsF8IAUGhoCwZA)                                      |
| 04  | East End      | Flag Hunt | 0:38.97 | 1299  | 48      | [04-east-end-flags.json](04-east-end-flags.json)             | [watch](https://gwynerva.github.io/parapet-classic/r/?AnUaeXge4DQQCEd3eW5lcnZhOHwGBDwoLEMwCwPB7B8Ag3h-EMYQEgQGBDiBRzwtigEwVwUAwh4MBfBIL8MChwn4bxQxEg_ihieAYJBkQgCCQ2AoNA)                  |
| 04  | East End      | Sprint    | 0:27.48 | 916   | 33      | [04-east-end-sprint.json](04-east-end-sprint.json)           | [watch](https://gwynerva.github.io/parapet-classic/r/?AnUaeXge4DIRCEd3eW5lcnZhKINhAhHpEhNpRovAeAkNA2FQGAXweC-FhY8I8CQjipQ2APgsC8FQdEulCkiC9Gg)                                             |
| 05  | Juniper Point | Flag Hunt | 0:33.63 | 1121  | 50      | [05-juniper-point-flags.json](05-juniper-point-flags.json)   | [watch](https://gwynerva.github.io/parapet-classic/r/?AnUa4isH90QSCEd3eW5lcnZhOYJhExLxKxaAoHAPhED-DgRwYC_BIODIDhFhW4PA4R8HgINgsMg2DcJ3BgBCXgHC4EDIlwigHhUDeAcTMPwmAuDmI4A)                 |
| 05  | Juniper Point | Sprint    | 0:34.53 | 1151  | 38      | [05-juniper-point-sprint.json](05-juniper-point-sprint.json) | [watch](https://gwynerva.github.io/parapet-classic/r/?AnUa4isH90ITCEd3eW5lcnZhLnwAhiF6j4ODYpB0MhaC4fAIeE4QA2BoSA8GRBFfwFBWC3A8JVJlJIepJBgH8HBMMiHiKA)                                      |
| 06  | Oak Valley    | Flag Hunt | 0:41.91 | 1397  | 41      | [06-oak-valley-flags.json](06-oak-valley-flags.json)         | [watch](https://gwynerva.github.io/parapet-classic/r/?AnUaXa-qCFQUCEd3eW5lcnZhMIggGEfFERxQw0ArgkBvA8CQ1ihieHMQoOQuiGDIb4IBAGBkJwbxTxj4pgkBBMDGJeJ2JWFQLYIg)                                |
| 06  | Oak Valley    | Sprint    | 0:40.26 | 1342  | 32      | [06-oak-valley-sprint.json](06-oak-valley-sprint.json)       | [watch](https://gwynerva.github.io/parapet-classic/r/?AnUaXa-qCFIVCEd3eW5lcnZhKHwIdKdFUDoSBDRSDAVUTQT0fUW0X0aUV0g6KwIA8N6LQfofAELBCURQQ0RwPUaUNA)                                          |
| 07  | Grass Bay     | Flag Hunt | 0:34.23 | 1141  | 43      | [07-grass-bay-flags.json](07-grass-bay-flags.json)           | [watch](https://gwynerva.github.io/parapet-classic/r/?AnUavgjsxWQWCEd3eW5lcnZhM3wAQ6GCkCEcJAzwdAIXuDQWDAj4SAYSDIl8GgGEilCk8G-FKC-LYnUnwlUpjIBXhAFcCBLwaBQ0AoR8Kg)                          |
| 07  | Grass Bay     | Sprint    | 0:32.91 | 1097  | 37      | [07-grass-bay-sprint.json](07-grass-bay-sprint.json)         | [watch](https://gwynerva.github.io/parapet-classic/r/?AnUavgjsxWIXCEd3eW5lcnZhLIhAIMiGCgaGQrCIFIAhkRQb4egniSC4QsUuG6TqT6SqVKShCpMgnR-ClIMFQvBEQ6EA)                                        |
| 08  | Sand Cape     | Flag Hunt | 0:36.51 | 1217  | 42      | [08-sand-cape-flags.json](08-sand-cape-flags.json)           | [watch](https://gwynerva.github.io/parapet-classic/r/?AnUa45DpqXQYCEd3eW5lcnZhMnwAAaGHHhBoI4OA_g4EAjgsG-FB4pEIFBANAeEjEHDMEsT8PwQELELEbE8QcRMR8T8T8Q-JMJ1J9K3gEA)                          |
| 08  | Sand Cape     | Sprint    | 0:21.96 | 732   | 20      | [08-sand-cape-sprint.json](08-sand-cape-sprint.json)         | [watch](https://gwynerva.github.io/parapet-classic/r/?AnUa45DpqXIZCEd3eW5lcnZhbiGAQyFqJC-GRBhapMpcDMMKIKJAKBsJQ1gO)                                                                        |
| 09  | Central Park  | Flag Hunt | 0:27.63 | 921   | 25      | [09-central-park-flags.json](09-central-park-flags.json)     | [watch](https://gwynerva.github.io/parapet-classic/r/?AnUaqG2mNIQaCEd3eW5lcnZhIAEh14hggHBoQw3h-CeKmJ-LWKeGmGuGsDYc4YYX4YAFwTo)                                                             |
| 09  | Central Park  | Sprint    | 0:32.01 | 1067  | 28      | [09-central-park-sprint.json](09-central-park-sprint.json)   | [watch](https://gwynerva.github.io/parapet-classic/r/?AnUaqG2mNIIbCEd3eW5lcnZhJHwIdH4LUmwepRowowofgkBikRSHpHURwXUGgyAgNAGDIUA1Q_AhRhRfQKA)                                                 |
| 10  | Bird Bay      | Flag Hunt | 0:40.32 | 1344  | 44      | [10-bird-bay-flags.json](10-bird-bay-flags.json)             | [watch](https://gwynerva.github.io/parapet-classic/r/?AnUacPtQbJQcCEd3eW5lcnZhM4DhnxQxRwwA_CCCvCQBBMA6AgZA8IWKAIgQGRCxPhk4p4oh4OiiKMCEBuC_AwO4S8EgwPhoGQzQDxGxCA)                          |
| 10  | Bird Bay      | Sprint    | 0:39.54 | 1318  | 38      | [10-bird-bay-sprint.json](10-bird-bay-sprint.json)           | [watch](https://gwynerva.github.io/parapet-classic/r/?AnUacPtQbJIdCEd3eW5lcnZhLnwARkpPAsIVKgHhGg2CqRQkGgWAQ-F6W6QYRKUYTaU6TaTAN4nCsIgIhKpDgvR-EOk-k-i-hIA)                                 |
| 11  | West Harbour  | Flag Hunt | 0:41.28 | 1376  | 39      | [11-west-harbour-flags.json](11-west-harbour-flags.json)     | [watch](https://gwynerva.github.io/parapet-classic/r/?AnUayM7jHqQeCEd3eW5lcnZhLoNhHEgTMSQKg6FsWMB8UwtiXieAPD2LOJ-GeF4U4UgWLoGQF4QYPwFYQwV4RQM4PwRgVA9hVgIA)                                |
| 11  | West Harbour  | Sprint    | 1:06.03 | 2201  | 54      | [11-west-harbour-sprint.json](11-west-harbour-sprint.json)   | [watch](https://gwynerva.github.io/parapet-classic/r/?AnUayM7jHqIfCEd3eW5lcnZhPYkUrgh4PCaBsGeCosPA4EOCQM-DeGXCsHgNglozoxo0oz8QcCvCKiGjQOQIgTBcBAaCeiWBekJSao3pBAHRJR8CtElFIjaKQiouopBehIA) |
| 12  | Pine Island   | Flag Hunt | 0:25.92 | 864   | 25      | [12-pine-island-flags.json](12-pine-island-flags.json)       | [watch](https://gwynerva.github.io/parapet-classic/r/?AnUacUGH4rQgCEd3eW5lcnZhIXwAQHiWFvjbB6CkOFwDw1TA8LeLwUhG4kUpeAMGgJCHiFCDihijg8A)                                                     |
| 12  | Pine Island   | Sprint    | 0:35.97 | 1199  | 36      | [12-pine-island-sprint.json](12-pine-island-sprint.json)     | [watch](https://gwynerva.github.io/parapet-classic/r/?AnUacUGH4rIhCEd3eW5lcnZhK4hCCIohAdSSAqPgEKeIOJHBwLpeCXhIeSKwWYYAfwbFaDNA4fgz4R8BwMA0GQdAqBw)                                         |

Total: 13:31.74.
