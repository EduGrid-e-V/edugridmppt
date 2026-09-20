# Manual test scripts

## MS3 simulator playground

1. Open `/play`, select `edugrid-kit`, set irradiance to 800 W/m²,
   ambient temperature to 25 °C, load to 50 Ω, and mode to Manual.
2. Move duty while watching panel power. The deterministic model peaks near
   duty 0.75–0.76 at approximately 1.20 W under these cell-temperature
   conditions.
3. Select Auto and P&O. It must settle within 2% of the manual peak, while
   continuing to oscillate by its fixed step. Automated result: MPP ratio
   `1.0000` after 200 ticks.
4. Select `passing-cloud` and play it past 40 s. Power drops at the cloud edge;
   the fixed-step tracker reacquires within the accepted 4 s interval.
5. Select `roof-module-450w`. Confirm that the voltage axis rescales to its
   roughly 50 V range rather than retaining the small-panel scale.
6. Run Sweep. Confirm that the I–V and power traces contain the full 48-point
   sweep and that the visible duty remains unchanged.
7. Select **Record current reading to lab book** and confirm the polite status
   message appears.
