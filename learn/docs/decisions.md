# Engineering decisions

## Panel listing

The EduGrid kit preset trusts the listed 13.5 V open-circuit voltage, 0.180 A
short-circuit current, and 110 × 136 mm outline. It rejects the advertised 5 W
because 5 W at the listed 12 V would require more current than the stated
short-circuit current. The modeled MPP is 10.8 V × 0.158 A = 1.7064 W.

## Scenario inputs

Built-in scenarios last 120 s. They control irradiance and inherit the engine's
ambient-temperature input unless a future keyframe explicitly overrides it.
