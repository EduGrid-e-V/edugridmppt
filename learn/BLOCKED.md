# Blocked tasks

## T-1.6 — Deterministic noise
**Blocked on:** T-1.6 requires `createEngine({seed})` and frame sequences, while the engine lifecycle, commands, and tick pipeline are not specified until T-2.4 and depend on the T-2.1 converter.
**Tried:** Cross-checked T-1.6 with T-2.4 and T-2.5; implementing the required engine behavior now would start MS2 and invent unspecified interim semantics.
**Need:** Move T-1.6 after T-2.4, or define a standalone noise API and its exact input/output contract for MS1.
**Proceeding with:** Independent task T-1.4 only; no engine implementation.

## T-1.5 — Scenario scripting
**Blocked on:** R1 makes §7 the only allowed source for numeric constants, but T-1.5's scenario values exist only in the task; passing-cloud and partial-shade also have no `durationS`, and no scenario specifies `ambientC`.
**Tried:** Used the specified keyframes to determine possible endpoints, but “hold” requires an unspecified duration after the final partial-shade ramp and passing-cloud likewise gives no end time.
**Need:** Add all three complete scenario objects (including `durationS` and `ambientC`) to §7, or explicitly authorize task-local constants and define the missing values.
**Proceeding with:** Nothing; T-1.3, T-1.5, and T-1.6 block completion of MS1.

## T-2.2 — Tracking algorithms
**Blocked on:** The required Incremental Conductance implementation and its self-check contradict each other. Porting §7.7 and `runReferenceIncrementalConductance` exactly makes a start at duty 0.10 alternate forever between 0.05 and 0.06 in the specified static load-line model, rather than reaching within 2% of MPP in fewer than 200 steps.
**Tried:** Implemented the scaled §7.7 thresholds and signs, coupled the algorithm to the T-2.1 solver using the §7.5 `up203-module` and a 50 Ω load, and traced the first 200 steps. At 0.05/0.06 duty, `|dV| < 0.02 V`; the prescribed small-`dV` branch reverses each current change and traps the controller. Its final power is 0.627% of MPP. P&O reaches the target from both required starts, and IncCond reaches it from 0.95, isolating the failure to this branch.
**Need:** Decide whether to change the small-`dV` IncCond sign/logic for the buck converter, change the convergence self-check or starting condition, or model converter dynamics/noise that make `|dV|` exceed the threshold. Also correct Prompt 5's source reference: `runStudentMpptAlgorithm` is an intentional no-op TODO; reference P&O is in `firmware/src/mppt_alg_reference.cpp`.
**Proceeding with:** No algorithm code committed, because changing the sign would violate “exactly as firmware” and keeping it would knowingly fail the Definition of Done.
