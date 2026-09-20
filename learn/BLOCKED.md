# Blocked tasks

## T-1.3 — Panel presets
**Blocked on:** Workplan §3.2 requires `cellAreaM2` and `nCells`, but §7.5 provides neither value for four of the five presets.
**Tried:** Cross-checked §3.2, §7.5, §9.1, and the frozen preset assertions; only `areaM2` is specified and the tests do not resolve the missing contract fields.
**Need:** The missing cell areas and cell counts, or an explicit decision that these fields are optional.
**Proceeding with:** Independent tasks T-1.4 and T-1.5 only.

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
