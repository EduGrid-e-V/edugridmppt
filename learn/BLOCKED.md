# Blocked tasks

## T-1.6 — Deterministic noise (rescheduled)
**Decision:** Implement this immediately after T-2.4, inside the completed engine. This avoids inventing an interim engine lifecycle and precedes the T-2.5 public API freeze.

## T-2.2 — Tracking algorithms
**Blocked on:** The approved 0.02 start, +0.05 first kick, and scaled 0.002 V IncCond threshold fix the original low-duty trap, but two remaining self-checks conflict with the fixed 0.01 duty step. After the specified passing-cloud change from 900 to 250 W/m², optimal duty moves from about 0.79 to 0.42. Moving 0.37 duty at 0.01 per 100 ms update takes at least 3.7 s, so reacquisition in under 3 s is impossible. IncCond also has the same 0.02 peak-to-peak steady-state ripple as P&O because both cross the optimum in fixed 0.01 increments; it cannot satisfy the required strictly smaller ripple with the specified MPP threshold.
**Tried:** Implemented all four algorithms with the approved startup and voltage threshold. Both P&O and IncCond reached 98% MPP from duties 0.02 and 0.95 in fewer than 200 steps. After the cloud edge, P&O first reached 98% after 34 updates and IncCond after 33. Both measured 0.02 steady-state duty ripple.
**Need:** Authorize adaptive or larger steps after irradiance transients and a smaller IncCond step near MPP, or change the 3 s and strict-ripple requirements. The firmware uses one fixed 0.01 step, so either option creates an intentional simulator/firmware difference that should be documented.
**Proceeding with:** No algorithm code committed until all T-2.2 self-checks can be satisfied honestly.

## T-2.3 through T-2.6 — Remaining MS2 dependency chain
**Blocked on:** T-2.4 consumes the T-2.2 algorithm map, T-2.5 freezes the resulting engine API, and T-2.6 migrates the dashboard to that API. T-2.3's live/simulation mismatch warning also needs the selected engine preset alongside a real hardware frame. Implementing any of these completely before resolving T-2.2 would require a temporary public contract or duplicate integration work.
**Ready:** T-1.3 now makes `edugrid-kit` the 1.7064 W default and provides its provenance; T-1.5 now provides complete deterministic scenarios. Those prerequisites no longer block the engine.
**Need:** Resolve T-2.2. Then implement T-2.4, the rescheduled T-1.6 noise, T-2.3 integration, T-2.5 API freeze, and T-2.6 migration in that order.
