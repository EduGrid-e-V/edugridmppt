/**
 * @file main.cpp
 * @brief Main firmware loop for the EduGrid MPPT trainer.
 *
 * This file connects the hardware modules together. Students should usually
 * edit mppt_alg.cpp, not this file.
 */

#include <Arduino.h>
#include <Wire.h>
#include "config.h"
#include "pwm_manager.h"
#include "sensor_manager.h"
#include "display_manager.h"
#include "input_manager.h"
#include "mppt_alg.h"

#if defined(ESP32) && ENABLE_WIFI_DASHBOARD
#include "wifi_manager.h"
#include "sweep_manager.h"
#endif

// ================= SYSTEM STATE =================
Mode mode = MODE_AUTO;
Mode previousMode = MODE_AUTO;
Algorithm currentAlgorithm = (Algorithm)DEFAULT_MPPT_ALGORITHM;

// ================= MEASUREMENTS =================
float PanelVoltage = 0.0f;
float PanelCurrent = 0.0f;
float PanelPower = 0.0f;
float LoadVoltage = 0.0f;
float LoadCurrent = 0.0f;
float LoadPower = 0.0f;
bool LoadSensorAvailable = false;

// ================= TIMERS =================
unsigned long lastControlLoopMs = 0;
unsigned long startupMs = 0;
unsigned long lastDisplayUpdateMs = 0;

static void printStartupMessage();
static void handleButtonInput(unsigned long now);
static void handleModeChange();
static void runSoftStartIfNeeded(unsigned long now);
static bool readSolarPanelMeasurements();
static void runAutomaticOrManualControl();
static void sendMeasurementsToDashboard();

void setup() {
    Serial.begin(115200);

    unsigned long serialWaitStart = millis();
    while (!Serial && millis() - serialWaitStart < 1500) {
        delay(10);
    }

    setupInputs();
    printStartupMessage();

    Wire.begin();
    Wire.setClock(400000);

    if (!setupSensor()) {
        Serial.println(F("Panel INA226 sensor init failed"));
    } else {
        Serial.println(F("Panel INA226 sensor init OK"));
    }

    setupDisplay();
    setupPWM();

#if defined(ESP32) && ENABLE_WIFI_DASHBOARD
    setupWiFi();
#endif

    startupMs = millis();
    lastControlLoopMs = startupMs;
    lastDisplayUpdateMs = startupMs;

    setConverterDutyCycle(PWM_MIN_DUTY);
}

void loop() {
    unsigned long now = millis();

#if defined(ESP32) && ENABLE_WIFI_DASHBOARD
    handleWiFi();
#endif

    handleButtonInput(now);
    handleModeChange();
    runSoftStartIfNeeded(now);

    bool timeForControlLoop =
        now - lastControlLoopMs >= MPPT_PERIOD_MS;

    if (timeForControlLoop) {
        lastControlLoopMs = now;

        bool sensorSettled =
            now - getLastPwmChange() >= INA_SETTLE_MS;

        if (sensorSettled && readSolarPanelMeasurements()) {
            sendMeasurementsToDashboard();
            runAutomaticOrManualControl();
        }
    }

    bool timeForDisplay =
        now - lastDisplayUpdateMs >= DISPLAY_PERIOD_MS;

    if (timeForDisplay) {
        lastDisplayUpdateMs = now;
        displayTelemetry(PanelPower,
                         PanelVoltage,
                         PanelCurrent,
                         LoadPower,
                         LoadVoltage,
                         LoadCurrent,
                         LoadSensorAvailable,
                         getConverterDutyCycle(),
                         mode,
                         currentAlgorithm);
    }
}

static void printStartupMessage() {
    Serial.println(F("\nEduGrid MPPT trainer"));
    Serial.println(F("Students edit firmware/src/mppt_alg.cpp"));
    Serial.println(F("Gate PWM active; Duty 10-90%"));
    Serial.print(F("INA226 shunt [Ohm]: "));
    Serial.println(SHUNT_OHMS, 6);
}

static void handleButtonInput(unsigned long now) {
    ButtonEvent buttonEvent = checkButtonEvent(now);

    if (buttonEvent == BTN_SHORT_PRESS) {
        mode = (mode == MODE_AUTO) ? MODE_MANUAL : MODE_AUTO;
        Serial.print(F("Mode changed to "));
        Serial.println(mode == MODE_AUTO ? F("AUTO") : F("MANUAL"));
#if defined(ESP32) && ENABLE_WIFI_DASHBOARD
        clearWebManualDuty();
#endif
    } else if (buttonEvent == BTN_LONG_PRESS) {
        currentAlgorithm = (currentAlgorithm == ALGORITHM_INCCOND)
            ? ALGORITHM_PNO
            : ALGORITHM_INCCOND;

        Serial.print(F("Algorithm changed to "));
        Serial.println(currentAlgorithm == ALGORITHM_PNO ? F("Student/P&O") : F("IncCond"));
        resetMPPT();
    }
}

static void handleModeChange() {
    if (mode == previousMode) return;

    if (mode == MODE_AUTO) {
        resetMPPT();
    }

    previousMode = mode;
}

static void runSoftStartIfNeeded(unsigned long now) {
    if (now - startupMs >= SOFTSTART_MS) return;

    float startupProgress =
        (now - startupMs) / (float)SOFTSTART_MS;
    float softStartDuty =
        PWM_MIN_DUTY + startupProgress * (0.5f - PWM_MIN_DUTY);

    setConverterDutyCycle(softStartDuty);
}

static bool readSolarPanelMeasurements() {
    PowerStageMeasurements sample;

    if (!readSensors(sample)) {
        setConverterDutyCycle(PWM_MIN_DUTY);
        delay(1);
        return false;
    }

    LoadSensorAvailable = sample.loadSensorIsReady;

    PanelVoltage = sample.panelVoltageVolts;
    PanelCurrent = sample.panelCurrentAmps;
    PanelPower = sample.panelPowerWatts;
    LoadVoltage = sample.loadVoltageVolts;
    LoadCurrent = sample.loadCurrentAmps;
    LoadPower = sample.loadPowerWatts;

    return true;
}

static void sendMeasurementsToDashboard() {
#if defined(ESP32) && ENABLE_WIFI_DASHBOARD
    if (isSweeping()) {
        if (updateSweep()) {
            broadcastSweepDone();
        }
    } else {
        broadcastMpptData(PanelVoltage,
                          PanelCurrent,
                          PanelPower);
    }
#endif
}

static void runAutomaticOrManualControl() {
#if defined(ESP32) && ENABLE_WIFI_DASHBOARD
    if (isSweeping()) return;
#endif

    if (mode == MODE_AUTO) {
        if (PanelVoltage < VIN_VALID_MIN) {
            setConverterDutyCycle(PWM_MIN_DUTY);
            Serial.println(F("Panel voltage too low; holding minimum duty"));
            return;
        }

        runSelectedMpptAlgorithm(PanelVoltage,
                                 PanelCurrent,
                                 LoadVoltage,
                                 LoadCurrent,
                                 LoadSensorAvailable,
                                 currentAlgorithm);
        return;
    }

#if defined(ESP32) && ENABLE_WIFI_DASHBOARD
    if (isWebManualDutyActive()) {
        float knobDuty = 0.0f;

        if (readManualDutyIfPotentiometerMoved(knobDuty)) {
            clearWebManualDuty();
            setConverterDutyCycle(knobDuty);
            return;
        }

        setConverterDutyCycle(getWebManualDuty());
        return;
    }
#endif

    float knobDuty = readManualDuty();
    setConverterDutyCycle(knobDuty);
}
