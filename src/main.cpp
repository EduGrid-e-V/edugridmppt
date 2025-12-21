/**
 * @file main.cpp
 * @brief Main application entry point.
 *
 * This file coordinates the system modules:
 * - Initializes hardware (PWM, Sensor, Display, Inputs).
 * - Runs the main control loop.
 * - Handles mode switching (Auto/Manual).
 * - Executes the MPPT algorithm or manual control.
 * - Updates the display and serial telemetry.
 */
#include <Arduino.h>
#include <Wire.h>
#include "config.h"
#include "pwm_manager.h"
#include "sensor_manager.h"
#include "display_manager.h"
#include "input_manager.h"
#include "mppt_alg.h"
#ifdef ESP32
#include "wifi_manager.h"
#include "sweep_manager.h"
#endif

// ================= STATE VARIABLES =================

/** @brief Current operating mode (AUTO or MANUAL). */
Mode mode = MODE_AUTO;

/** @brief Previous operating mode (used to detect changes). */
Mode lastMode = MODE_AUTO;

/** @brief Current MPPT Algorithm. */
Algorithm currentAlgorithm = (Algorithm)DEFAULT_MPPT_ALGORITHM;

// ================= FILTERED MEASUREMENTS =================

/** @brief Low-pass filtered Input Voltage (V). */
float fVin = 0;

/** @brief Low-pass filtered Input Current (A). */
float fIin = 0;

/** @brief Low-pass filtered Input Power (W). */
float fPin = 0;

// ================= TIMING VARIABLES =================

unsigned long t_last      = 0;  /** @brief Timestamp of the last MPPT/Control loop execution. */

unsigned long t_start     = 0;  /** @brief Timestamp of system start (used for soft-start). */

unsigned long t_disp_last = 0;  /** @brief Timestamp of the last display update. */
 
// ================= SETUP =================
void setup() {
  Serial.begin(115200);
  while (!Serial) {} // Wait for Serial Monitor
 
  // Initialize Inputs (Button, Potentiometer)
  setupInputs();
 
  // Print startup banner
  if (currentAlgorithm == ALGORITHM_PNO) {
    Serial.println(F("\nMPPT Buck (Perturb & Observe) mit INA226 @0x40"));
  } else {
    Serial.println(F("\nMPPT Buck (Incremental Conductance) mit INA226 @0x40"));
  }

  Serial.println(F("D9 = Gate, ~31kHz PWM; Duty 10–90%"));
  Serial.print  (F("Shunt [Ohm]: ")); Serial.println(SHUNT_OHMS, 6);
 
  // Initialize I2C
  Wire.begin();                 
  Wire.setClock(400000);        // 400 kHz Fast Mode
 
  // Initialize Sensor
  if (!setupSensor()) {
    Serial.println(F("INA226 init failed"));
  } else {
    Serial.println(F("INA226 init OK"));
  }
 
  // Initialize Display and PWM
  setupDisplay();
  setupPWM();
 
#ifdef ESP32
  setupWiFi();
#endif

  // Initialize timers
  t_last        = millis();
  t_start       = t_last;
  t_disp_last   = t_last;
 
  // Start with minimum duty cycle
  setDuty(PWM_MIN_DUTY); 
}
 
// ================= MAIN LOOP =================
void loop() {
  unsigned long now = millis();

#ifdef ESP32
  handleWiFi();
#endif
 
  // 1. Handle User Input
  ButtonEvent btnEvent = checkButtonEvent(now);
  if (btnEvent == BTN_SHORT_PRESS) {
      // Short Press: Toggle Mode
      mode = (mode == MODE_AUTO) ? MODE_MANUAL : MODE_AUTO;
  } else if (btnEvent == BTN_LONG_PRESS) {
      // Long Press: Toggle Algorithm
      if (currentAlgorithm == ALGORITHM_INCCOND) {
          currentAlgorithm = ALGORITHM_PNO;
          Serial.println(F("Algorithm changed to P&O"));
      } else {
          currentAlgorithm = ALGORITHM_INCCOND;
          Serial.println(F("Algorithm changed to IncCond"));
      }
      // Reset MPPT state on algorithm change
      resetMPPT();
  }
 
  // 2. Mode Change Handling
  if (mode != lastMode) {
    if (mode == MODE_AUTO) {
      // Reset MPPT state when switching back to Auto to ensure a fresh start
      resetMPPT();
    }
    lastMode = mode;
  }
 
  // 3. Soft-start Logic
  // Gradually ramp up duty cycle at startup to prevent inrush current
  if (now - t_start < SOFTSTART_MS) {
    float k = (now - t_start) / (float)SOFTSTART_MS; // 0..1
    float target = PWM_MIN_DUTY + k * (0.5f - PWM_MIN_DUTY);
    setDuty(target);
  }
 
  // 4. Control Loop (MPPT or Manual)
  if (now - t_last >= MPPT_PERIOD_MS) {
    t_last = now;
 
    // Ensure INA sensor had time to settle after the last PWM change
    if (now - getLastPwmChange() < INA_SETTLE_MS) {
      // Too early to read -> skip this cycle
    } else {
      float Vin, Iin;
      
      // Read Sensor
      if (!readSensor(Vin, Iin)) {
        //Serial.println(F("INA226 read error; set Duty to minimum"));
        setDuty(PWM_MIN_DUTY);
        delay(1);
      } else {
        // Clamp negative current readings
        if (Iin < IIN_VALID_MIN) Iin = 0.0f;
        float Pin = Vin * Iin;
 
        // Low-pass Filter (IIR)
        // y[n] = (1-alpha)*y[n-1] + alpha*x[n]
        if (fVin == 0 && fIin == 0 && fPin == 0) {
          fVin = Vin; fIin = Iin; fPin = Pin;
        } else {
          fVin = (1 - ALPHA) * fVin + ALPHA * Vin;
          fIin = (1 - ALPHA) * fIin + ALPHA * Iin;
          fPin = (1 - ALPHA) * fPin + ALPHA * Pin;
        }
 
        // Execute Control Logic
#ifdef ESP32
        if (isSweeping()) {
            updateSweep();
        } else {
            // Broadcast data point via WebSocket
            broadcastMpptData(fVin, fIin, fPin);
        }
#endif
        if (!isSweeping() && mode == MODE_AUTO) {
          if (fVin < VIN_VALID_MIN) {
            // Input voltage too low for MPPT
            setDuty(PWM_MIN_DUTY);
            Serial.println(F("VIN too low; hold min duty (AUTO)"));
          } else {
            // Run selected MPPT Algorithm
            if (currentAlgorithm == ALGORITHM_PNO) {
              mpptPerturbObserve(fVin, fIin);
            } else {
              mpptIncrementalConductance(fVin, fIin);
            }
          }
        } else { // MODE_MANUAL
          // Read potentiometer and set duty cycle
          float d = readManualDuty();
          setDuty(d);
        }
      }
    }
 
    // Serial Telemetry
    /*
    Serial.print(F("Mode="));   Serial.print((mode == MODE_AUTO) ? F("AUTO") : F("MAN")); Serial.print(F("  "));
    Serial.print(F("Duty="));   Serial.print(getDuty() * 100.0f, 0);  Serial.print(F("%  "));
    Serial.print(F("Vin="));    Serial.print(fVin, 3);           Serial.print(F(" V  "));
    Serial.print(F("Iin="));    Serial.print(fIin, 3);           Serial.print(F(" A  "));
    Serial.print(F("Pin="));    Serial.print(fPin, 3);           Serial.println(F(" W"));
    */
  }
 
  // 5. Update Display
  if (now - t_disp_last >= DISPLAY_PERIOD_MS) {
    t_disp_last = now;
    displayTelemetry(fPin, fVin, fIin, getDuty(), mode, currentAlgorithm);
  }
}
