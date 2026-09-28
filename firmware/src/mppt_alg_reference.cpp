/**
 * @file mppt_alg_reference.cpp
 * @brief Firmware implementation of Perturb and Observe.
 *
 * The dashboard's P&O selection always runs this controller.
 */

#include "mppt_alg_reference.h"
#include "config.h"

static bool referencePreviousMeasurementIsValid = false;
static float referencePreviousPanelPowerWatts = 0.0f;
static int referenceDutyCycleDirection = -1;

void resetReferencePerturbObserve() {
    referencePreviousMeasurementIsValid = false;
    referencePreviousPanelPowerWatts = 0.0f;
    referenceDutyCycleDirection = -1;
}

void runReferencePerturbObserve(const SolarPanelMeasurement& measurement) {
    if (!referencePreviousMeasurementIsValid) {
        duty.change(-FIRST_KICK_STEP);
        referencePreviousPanelPowerWatts = measurement.panelPowerWatts;
        referencePreviousMeasurementIsValid = true;
        return;
    }

    float changeInPanelPowerWatts =
        measurement.panelPowerWatts - referencePreviousPanelPowerWatts;

    if (changeInPanelPowerWatts < 0.0f) {
        referenceDutyCycleDirection = -referenceDutyCycleDirection;
    }

    duty.change(referenceDutyCycleDirection * DUTY_STEP_START);
    referencePreviousPanelPowerWatts = measurement.panelPowerWatts;
}
