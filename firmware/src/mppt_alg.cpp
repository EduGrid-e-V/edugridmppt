/**
 * @file mppt_alg.cpp
 * @brief Student workspace for Maximum Power Point Tracking.
 *
 * Goal:
 * Move the solar panel operating point until panelPowerWatts is as high as possible.
 *
 * Important buck converter rule for this kit:
 * - Increasing duty cycle usually lowers the panel voltage.
 * - Decreasing duty cycle usually raises the panel voltage.
 */

#include "mppt_alg.h"
#include "config.h"
#include "pwm_manager.h"
#include <math.h>

// ================= STUDENT-FRIENDLY SETTINGS =================
const float smallDutyCycleStep = DUTY_STEP_START;
const float firstTestStepAfterReset = FIRST_KICK_STEP;

// ================= MEMORY FROM THE PREVIOUS MEASUREMENT =================
static bool previousMeasurementIsValid = false;
static float previousPanelVoltageVolts = 0.0f;
static float previousPanelCurrentAmps = 0.0f;
static float previousPanelPowerWatts = 0.0f;
static SolarPanelMeasurement currentMeasurement;

// This remembers which way the student/example algorithm last moved the duty cycle.
// -1 means duty was decreased, +1 means duty was increased.
static int lastDutyCycleDirection = -1;

MeasurementPort PV(false);
MeasurementPort load(true);
DutyControl duty;

static SolarPanelMeasurement makeSolarPanelMeasurement(float panelVoltageVolts,
                                                       float panelCurrentAmps,
                                                       float loadVoltageVolts = 0.0f,
                                                       float loadCurrentAmps = 0.0f,
                                                       bool loadSensorIsAvailable = false);
static void rememberMeasurement(const SolarPanelMeasurement& measurement);
static void runReferenceIncrementalConductance(const SolarPanelMeasurement& measurement);

void resetMPPT() {
    previousMeasurementIsValid = false;
    previousPanelVoltageVolts = 0.0f;
    previousPanelCurrentAmps = 0.0f;
    previousPanelPowerWatts = 0.0f;
    lastDutyCycleDirection = -1;
}

void runSelectedMpptAlgorithm(float panelVoltageVolts,
                              float panelCurrentAmps,
                              float loadVoltageVolts,
                              float loadCurrentAmps,
                              bool loadSensorIsAvailable,
                              Algorithm selectedAlgorithm) {
    SolarPanelMeasurement measurement =
        makeSolarPanelMeasurement(panelVoltageVolts,
                                  panelCurrentAmps,
                                  loadVoltageVolts,
                                  loadCurrentAmps,
                                  loadSensorIsAvailable);
    currentMeasurement = measurement;

    if (measurement.panelVoltageVolts < VIN_VALID_MIN) {
        setConverterDutyCycle(PWM_MIN_DUTY);
        rememberMeasurement(measurement);
        return;
    }

    if (selectedAlgorithm == ALGORITHM_INCCOND) {
        runReferenceIncrementalConductance(measurement);
    } else {
        runStudentMpptAlgorithm(measurement);
    }
}

void runStudentMpptAlgorithm(const SolarPanelMeasurement& measurement) {
    if (!previousMeasurementIsValid) {
        duty.change(-firstTestStepAfterReset);
        rememberMeasurement(measurement);
        return;
    }

    float changeInPanelPowerWatts =
        measurement.panelPowerWatts - previousPanelPowerWatts;

    /*
     * ##### YOUR CODE GOES HERE #####
     *
     * Hints:
     * 1. Watch PV.getPower(). Your goal is to make it larger.
     * 2. Try changing the duty cycle a little bit.
     * 3. If the power went up, keep moving in the same direction.
     * 4. If the power went down, reverse direction.
     * 5. Use the short student API:
     *
     *      PV.getVoltage()
     *      PV.getCurrent()
     *      PV.getPower()
     *      load.getVoltage()
     *      duty.get()
     *      duty.set(0.50f)
     *      duty.change(+smallDutyCycleStep)
     *
     * The longer measurement.panelVoltageVolts-style names still work.
     */

    // Simple working example: Perturb and Observe.
    if (changeInPanelPowerWatts < 0.0f) {
        lastDutyCycleDirection = -lastDutyCycleDirection;
    }

    duty.change(lastDutyCycleDirection * smallDutyCycleStep);

    /*
     * ##### END OF STUDENT SECTION #####
     */

    rememberMeasurement(measurement);
}

void setConverterDutyCycle(float requestedDutyCycle) {
    setDuty(requestedDutyCycle);
}

void changeConverterDutyCycle(float dutyCycleChange) {
    setConverterDutyCycle(getConverterDutyCycle() + dutyCycleChange);
}

float getConverterDutyCycle() {
    return getDuty();
}

void mpptPerturbObserve(float panelVoltageVolts, float panelCurrentAmps) {
    currentMeasurement = makeSolarPanelMeasurement(panelVoltageVolts, panelCurrentAmps);
    runStudentMpptAlgorithm(currentMeasurement);
}

void mpptIncrementalConductance(float panelVoltageVolts, float panelCurrentAmps) {
    currentMeasurement = makeSolarPanelMeasurement(panelVoltageVolts, panelCurrentAmps);
    runReferenceIncrementalConductance(currentMeasurement);
}

MeasurementPort::MeasurementPort(bool loadSide) : loadSide(loadSide) {}

float MeasurementPort::getVoltage() const {
    return loadSide ? currentMeasurement.loadVoltageVolts : currentMeasurement.panelVoltageVolts;
}

float MeasurementPort::getCurrent() const {
    return loadSide ? currentMeasurement.loadCurrentAmps : currentMeasurement.panelCurrentAmps;
}

float MeasurementPort::getPower() const {
    return loadSide ? currentMeasurement.loadPowerWatts : currentMeasurement.panelPowerWatts;
}

bool MeasurementPort::isAvailable() const {
    return !loadSide || currentMeasurement.loadSensorIsAvailable;
}

float DutyControl::get() const {
    return getConverterDutyCycle();
}

void DutyControl::set(float requestedDutyCycle) const {
    setConverterDutyCycle(requestedDutyCycle);
}

void DutyControl::change(float dutyCycleChange) const {
    changeConverterDutyCycle(dutyCycleChange);
}

static SolarPanelMeasurement makeSolarPanelMeasurement(float panelVoltageVolts,
                                                       float panelCurrentAmps,
                                                       float loadVoltageVolts,
                                                       float loadCurrentAmps,
                                                       bool loadSensorIsAvailable) {
    SolarPanelMeasurement measurement;
    measurement.panelVoltageVolts = panelVoltageVolts;
    measurement.panelCurrentAmps = panelCurrentAmps;
    measurement.panelPowerWatts = panelVoltageVolts * panelCurrentAmps;
    measurement.loadVoltageVolts = loadVoltageVolts;
    measurement.loadCurrentAmps = loadCurrentAmps;
    measurement.loadPowerWatts = loadVoltageVolts * loadCurrentAmps;
    measurement.loadSensorIsAvailable = loadSensorIsAvailable;
    measurement.converterDutyCycle = getConverterDutyCycle();
    return measurement;
}

static void rememberMeasurement(const SolarPanelMeasurement& measurement) {
    previousPanelVoltageVolts = measurement.panelVoltageVolts;
    previousPanelCurrentAmps = measurement.panelCurrentAmps;
    previousPanelPowerWatts = measurement.panelPowerWatts;
    previousMeasurementIsValid = true;
}

static void runReferenceIncrementalConductance(const SolarPanelMeasurement& measurement) {
    const float voltageChangeThresholdVolts = 0.02f;
    const float currentChangeThresholdAmps = 0.0001f;
    const float maximumPowerPointThreshold = 0.0005f;

    if (!previousMeasurementIsValid) {
        changeConverterDutyCycle(-firstTestStepAfterReset);
        rememberMeasurement(measurement);
        return;
    }

    float changeInPanelVoltageVolts =
        measurement.panelVoltageVolts - previousPanelVoltageVolts;
    float changeInPanelCurrentAmps =
        measurement.panelCurrentAmps - previousPanelCurrentAmps;

    if (fabsf(changeInPanelVoltageVolts) < voltageChangeThresholdVolts) {
        if (fabsf(changeInPanelCurrentAmps) < currentChangeThresholdAmps) {
            // Voltage and current are nearly unchanged. Hold the duty cycle.
        } else if (changeInPanelCurrentAmps > 0.0f) {
            changeConverterDutyCycle(-smallDutyCycleStep);
        } else {
            changeConverterDutyCycle(+smallDutyCycleStep);
        }
    } else {
        float incrementalConductance =
            changeInPanelCurrentAmps / changeInPanelVoltageVolts;
        float instantaneousConductance =
            measurement.panelCurrentAmps / measurement.panelVoltageVolts;
        float distanceFromMaximumPowerPoint =
            incrementalConductance + instantaneousConductance;

        if (fabsf(distanceFromMaximumPowerPoint) < maximumPowerPointThreshold) {
            // We are close to the maximum power point. Hold the duty cycle.
        } else if (distanceFromMaximumPowerPoint > 0.0f) {
            changeConverterDutyCycle(-smallDutyCycleStep);
        } else {
            changeConverterDutyCycle(+smallDutyCycleStep);
        }
    }

    rememberMeasurement(measurement);
}
