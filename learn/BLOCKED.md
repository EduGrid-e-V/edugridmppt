# Blocked tasks

## T-1.6 — Deterministic noise (rescheduled)
**Decision:** Implement this immediately after T-2.4, inside the completed engine. This avoids inventing an interim engine lifecycle and precedes the T-2.5 public API freeze.

## T-2.2 — Tracking algorithms
**Blocked on:** The required Incremental Conductance implementation and its self-check contradict each other. Porting §7.7 and `runReferenceIncrementalConductance` exactly makes a start at duty 0.10 alternate forever between 0.05 and 0.06 in the specified static load-line model, rather than reaching within 2% of MPP in fewer than 200 steps.
**Tried:** Implemented the scaled §7.7 thresholds and signs, coupled the algorithm to the T-2.1 solver using the §7.5 `up203-module` and a 50 Ω load, and traced the first 200 steps. At 0.05/0.06 duty, `|dV| < 0.02 V`; the prescribed small-`dV` branch reverses each current change and traps the controller. Its final power is 0.627% of MPP. P&O reaches the target from both required starts, and IncCond reaches it from 0.95, isolating the failure to this branch.
**Need:** Decide whether to change the small-`dV` IncCond sign/logic for the buck converter, change the convergence self-check or starting condition, or model converter dynamics/noise that make `|dV|` exceed the threshold. Also correct Prompt 5's source reference: `runStudentMpptAlgorithm` is an intentional no-op TODO; reference P&O is in `firmware/src/mppt_alg_reference.cpp`.
**Proceeding with:** No algorithm code committed, because changing the sign would violate “exactly as firmware” and keeping it would knowingly fail the Definition of Done.
