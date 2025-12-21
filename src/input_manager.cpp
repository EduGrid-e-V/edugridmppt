/**
 * @file input_manager.cpp
 * @brief Implementation of input handling functions.
 */

#include "input_manager.h"
#include "config.h"

// ================= BUTTON STATE =================

/** @brief Last stable state of the button (HIGH or LOW). */
static bool          btn_last_level = HIGH; // with PULLUP: HIGH=idle, LOW=pressed

/** @brief Timestamp of the last state change for debouncing. */
static unsigned long btn_last_change = 0;

/** @brief Timestamp when the button was pressed down. */
static unsigned long btn_press_start = 0;

/** @brief Flag to indicate if the long press event has already been triggered. */
static bool          btn_long_press_handled = false;

/** @brief Duration in milliseconds to trigger a long press. */
const unsigned long  LONG_PRESS_MS = 2000;

// ================= POTENTIOMETER STATE =================

/** @brief Minimum raw ADC value seen (for auto-calibration). */
static int   pot_min_seen = 1023;

/** @brief Maximum raw ADC value seen (for auto-calibration). */
static int   pot_max_seen = 0;

/** @brief Smoothed ADC value (0.0 to 1023.0). */
static float pot_smoothed = 0.0f;

void setupInputs() {
    pinMode(BTN_PIN, INPUT_PULLUP);
#ifdef ESP32
    analogReadResolution(10); // Set ADC to 10-bit to match AVR logic
#endif
    // Seed the smoothing filter with the initial reading
    pot_smoothed = analogRead(POT_PIN); 
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
  long sum = 0;
  for (int i = 0; i < POT_OVERSAMPLES; i++) {
    sum += analogRead(POT_PIN);
  }
  float raw_avg = (float)sum / (float)POT_OVERSAMPLES;  // 0..1023
 
  // 2. IIR Smoothing: Low-pass filter
  // y[n] = (1-alpha)*y[n-1] + alpha*x[n]
  pot_smoothed = (1.0f - POT_IIR_ALPHA) * pot_smoothed + POT_IIR_ALPHA * raw_avg;
 
  // 3. Auto-calibration (Optional)
  // Dynamically adjust min/max range based on observed values
  int smi = (int)(pot_smoothed + 0.5f);
#if POT_AUTOCAL
  if (smi < pot_min_seen) pot_min_seen = smi;
  if (smi > pot_max_seen) pot_max_seen = smi;
  
  // Prevent divide by zero & give some initial sane window
  // Ensure hi > lo
  int lo = (pot_min_seen <= pot_max_seen - 10) ? pot_min_seen : 0;
  int hi = (pot_max_seen >= pot_min_seen + 10) ? pot_max_seen : 1023;
#else
  int lo = 0, hi = 1023;
#endif
 
  // 4. Normalization
  // Map smoothed value from [lo..hi] to 0..1
  float norm = 0.0f;
  if (hi > lo) norm = (float)(smi - lo) / (float)(hi - lo);
  norm = constrain(norm, 0.0f, 1.0f);
 
  // 5. Map to Duty Cycle Range
  float duty_f = PWM_MIN_DUTY + norm * (PWM_MAX_DUTY - PWM_MIN_DUTY);
 
  // 6. Round to whole percent
  // This prevents the duty cycle from jittering between e.g. 50.1% and 49.9%
  int duty_pct = (int)lroundf(duty_f * 100.0f);     // integer %
  
  // Clamp final result
  duty_pct = constrain(duty_pct,
                       (int)(PWM_MIN_DUTY*100.0f + 0.5f),
                       (int)(PWM_MAX_DUTY*100.0f + 0.5f));
                       
  return duty_pct / 100.0f; // Convert back to 0..1 float
}
