/**
 * @file input_manager.cpp
 * @brief Implementation of input handling functions.
 */

#include "input_manager.h"
#include "config.h"
#include <math.h>

// ================= BUTTON STATE =================
static bool          btn_last_level = HIGH; /** @brief Last stable state of the button (HIGH or LOW). */ // with PULLUP: HIGH=idle, LOW=pressed
static unsigned long btn_last_change = 0;   /** @brief Timestamp of the last state change for debouncing. */
static unsigned long btn_press_start = 0;   /** @brief Timestamp when the button was pressed down. */
static bool          btn_long_press_handled = false; /** @brief Flag to indicate if the long press event has already been triggered. */
const unsigned long  LONG_PRESS_MS = 2000;  /** @brief Duration in milliseconds to trigger a long press. */

// ================= POTENTIOMETER STATE =================
#if POT_AUTOCAL
static int   pot_min_seen = POT_ADC_MAX; /** @brief Minimum raw ADC value seen (for auto-calibration). */
static int   pot_max_seen = 0;    /** @brief Maximum raw ADC value seen (for auto-calibration). */
#endif
static float pot_smoothed = 0.0f; /** @brief Smoothed ADC value. */
static float lastRememberedPotentiometerDutyCycle = PWM_MIN_DUTY;
static bool  potentiometerBaselineIsReady = false;
#if POT_DEBUG_SERIAL
static unsigned long lastPotDebugPrintMs = 0;
#endif

static float readPotentiometerAverage();
static float mapPotentiometerToDuty(float rawAdcValue);
static void printPotentiometerDebug(float rawAdcValue, float smoothedAdcValue, float dutyCycle);

void setupInputs() {
    pinMode(BTN_PIN, INPUT_PULLUP);
    pinMode(POT_PIN, INPUT);
#ifdef ESP32
    analogReadResolution(10); // Set ADC to 10-bit to match AVR logic
    analogSetPinAttenuation(POT_PIN, ADC_11db);
#endif

    // Seed the smoothing filter from an average so startup does not get stuck
    // near one noisy sample.
    pot_smoothed = readPotentiometerAverage();
    Serial.print(F("Pot raw startup: "));
    Serial.println((int)(pot_smoothed + 0.5f));
}

ButtonEvent checkButtonEvent(unsigned long now) {
  bool level = digitalRead(BTN_PIN);
  ButtonEvent event = BTN_NONE;
  
  // Check if state changed and debounce time has passed
  if (level != btn_last_level && (now - btn_last_change) >= BTN_DEBOUNCE_MS) {
    btn_last_change = now;
    btn_last_level = level;
    
    if (level == LOW) { 
      // Button Pressed Down
      btn_press_start = now;
      btn_long_press_handled = false;
    } else {
      // Button Released
      if (!btn_long_press_handled) {
        // If we haven't handled a long press yet, it's a short press
        event = BTN_SHORT_PRESS;
      }
    }
  }

  // Check for Long Press while holding
  if (level == LOW && !btn_long_press_handled) {
      if (now - btn_press_start > LONG_PRESS_MS) {
          event = BTN_LONG_PRESS;
          btn_long_press_handled = true; // Mark as handled so we don't trigger again
      }
  }

  return event;
}

float readManualDuty() {
  // 1. Oversampling: Take multiple readings and average them
  float raw_avg = readPotentiometerAverage();
 
  // 2. IIR Smoothing: Low-pass filter
  // y[n] = (1-alpha)*y[n-1] + alpha*x[n]
  float smoothingAlpha =
      (fabsf(raw_avg - pot_smoothed) >= POT_FAST_DELTA_RAW)
          ? POT_FAST_IIR_ALPHA
          : POT_IIR_ALPHA;
  pot_smoothed = (1.0f - smoothingAlpha) * pot_smoothed + smoothingAlpha * raw_avg;
 
  float dutyCycle = mapPotentiometerToDuty(pot_smoothed);
  printPotentiometerDebug(raw_avg, pot_smoothed, dutyCycle);

  return dutyCycle;
}

int readPotentiometerRaw() {
  return (int)(readPotentiometerAverage() + 0.5f);
}

void rememberCurrentPotentiometerPositionAsBaseline() {
  lastRememberedPotentiometerDutyCycle = readManualDuty();
  potentiometerBaselineIsReady = true;
}

bool readManualDutyIfPotentiometerMoved(float &manualDutyCycle) {
  manualDutyCycle = readManualDuty();

  if (!potentiometerBaselineIsReady) {
    lastRememberedPotentiometerDutyCycle = manualDutyCycle;
    potentiometerBaselineIsReady = true;
    return false;
  }

  bool potentiometerMovedEnough =
      fabsf(manualDutyCycle - lastRememberedPotentiometerDutyCycle) >= POT_TAKEOVER_THRESHOLD;

  if (potentiometerMovedEnough) {
    lastRememberedPotentiometerDutyCycle = manualDutyCycle;
  }

  return potentiometerMovedEnough;
}

static float readPotentiometerAverage() {
  long sum = 0;
  for (int i = 0; i < POT_OVERSAMPLES; i++) {
    sum += analogRead(POT_PIN);
  }

  return (float)sum / (float)POT_OVERSAMPLES;
}

static float mapPotentiometerToDuty(float rawAdcValue) {
  int smi = (int)(rawAdcValue + 0.5f);
#if POT_AUTOCAL
  if (smi < pot_min_seen) pot_min_seen = smi;
  if (smi > pot_max_seen) pot_max_seen = smi;
  
  int lo = (pot_min_seen <= pot_max_seen - 10) ? pot_min_seen : POT_ADC_MIN;
  int hi = (pot_max_seen >= pot_min_seen + 10) ? pot_max_seen : POT_ADC_MAX;
#else
  int lo = POT_ADC_MIN;
  int hi = POT_ADC_MAX;
#endif
 
  // 4. Normalization
  // Map smoothed value from [lo..hi] to 0..1
  float norm = 0.0f;
  if (hi > lo) norm = (float)(smi - lo) / (float)(hi - lo);
  norm = constrain(norm, 0.0f, 1.0f);
 
  // 5. Map to Duty Cycle Range
  float duty_f = PWM_MIN_DUTY + norm * (PWM_MAX_DUTY - PWM_MIN_DUTY);
 
  // 6. Round to whole percent
  // This prevents the duty cycle from flickering between e.g. 50.1% and 49.9%
  int duty_pct = (int)lroundf(duty_f * 100.0f);     // integer %
  
  // Clamp final result
  duty_pct = constrain(duty_pct,
                       (int)(PWM_MIN_DUTY*100.0f + 0.5f),
                       (int)(PWM_MAX_DUTY*100.0f + 0.5f));
                       
  return duty_pct / 100.0f; // Convert back to 0..1 float
}

static void printPotentiometerDebug(float rawAdcValue, float smoothedAdcValue, float dutyCycle) {
#if POT_DEBUG_SERIAL
  unsigned long now = millis();
  if (now - lastPotDebugPrintMs < 500) return;
  lastPotDebugPrintMs = now;

  Serial.print(F("POT raw="));
  Serial.print(rawAdcValue, 1);
  Serial.print(F(" smooth="));
  Serial.print(smoothedAdcValue, 1);
  Serial.print(F(" duty="));
  Serial.print(dutyCycle * 100.0f, 0);
  Serial.println(F("%"));
#else
  (void)rawAdcValue;
  (void)smoothedAdcValue;
  (void)dutyCycle;
#endif
}
