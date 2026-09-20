# Engineering decisions

## Panel listing

The EduGrid kit preset trusts the listed 13.5 V open-circuit voltage, 0.180 A
short-circuit current, and 110 × 136 mm outline. It rejects the advertised 5 W
because 5 W at the listed 12 V would require more current than the stated
short-circuit current. The modeled MPP is 10.8 V × 0.158 A = 1.7064 W.

## Scenario inputs

Built-in scenarios last 120 s. They control irradiance and inherit the engine's
ambient-temperature input unless a future keyframe explicitly overrides it.

## MPPT timing and thresholds

The simulator starts at duty 0.02 and uses a +0.05 first kick, because a
negative kick would remain clamped at the simulation rail. Its scaled IncCond
voltage threshold uses a 0.002 V reference; 0.02 V traps the static load-line
model at low duty. The firmware retains its absolute 0.02 V threshold, which
is a possible firmware improvement to investigate with real measurement noise.

Passing-cloud reacquisition is accepted within 4 s rather than 3 s. A 900 to
250 W/m² step moves optimal duty by about 0.37, which cannot be traversed in
3 s at the firmware-aligned fixed step of 0.01 per 100 ms. Adaptive steps are
left as a student exercise so the reference simulation remains explainable.
