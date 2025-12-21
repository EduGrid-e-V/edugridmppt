/**
 * @file mppt_alg.cpp
 * @brief Implementation of MPPT algorithms.
 */

#include "mppt_alg.h"
#include "config.h"
#include "pwm_manager.h"
#include <math.h>

// ================= SHARED STATE =================

/** @brief Previous Input Voltage (V) for differential calculation. */
static float prevVin = 0.0f;

/** 
 * @brief Previous Metric for differential calculation.
 * Stores Input Current (Iin) for Incremental Conductance.
 * Stores Input Power (Pin) for Perturb & Observe.
 */
static float prevMetric = 0.0f; 

/** @brief Flag indicating if the previous state is valid. */
static bool  have_prev = false;

void resetMPPT() {
    have_prev = false;
}

void mpptIncrementalConductance(float fVin, float fIin) {
  const float V_EPS    = 0.02f;    // Threshold for "Voltage has not changed"
  const float DI_EPS   = 0.0001f;  // Threshold for "Current has not changed"
  const float DIFF_EPS = 0.0005f;  // Threshold for "At MPP" (dI/dV + I/V ~ 0)
  
  float step = DUTY_STEP_START;
  float duty = getDuty();
 
  // --- Initialization Phase ---
  if (!have_prev) {
    prevVin    = fVin;
    prevMetric = fIin;
    have_prev  = true;
 
    // Initial Kick: Move away from the current point to see a change.
    // If we are high, go lower. If low, go higher.
    float mid = 0.5f * (PWM_MIN_DUTY + PWM_MAX_DUTY);
    if (duty >= mid) {
      setDuty(duty - FIRST_KICK_STEP);
    } else {
      setDuty(duty + FIRST_KICK_STEP);
    }
    return;
  }
 
  float dV = fVin - prevVin;
  float dI = fIin - prevMetric;
 
  // --- Safety Check ---
  // If voltage is too low, reset to minimum duty to prevent collapse
  if (fVin < VIN_VALID_MIN) {
    setDuty(PWM_MIN_DUTY);
    prevVin    = fVin;
    prevMetric = fIin;
    return;
  }
 
  // --- Algorithm Logic ---
  
  // Case 1: Voltage is constant (dV ~ 0)
  if (fabsf(dV) < V_EPS) {
    if (fabsf(dI) < DI_EPS) {
      // dV ~ 0 and dI ~ 0 -> Steady state, likely at MPP or stable. Do nothing.
    } else if (dI > 0) {
      // Current increased while Voltage constant -> Power increased.
      // We are on the left side of the curve (slope > 0).
      // For Buck: To increase Voltage (move right), we decrease Duty.
      setDuty(duty - step);
    } else {
      // Current decreased while Voltage constant -> Power decreased.
      // We are on the right side (slope < 0).
      // For Buck: To decrease Voltage (move left), we increase Duty.
      setDuty(duty + step);
    }
  }
 
  // Case 2: Voltage changed (dV != 0)
  else {
    float dIdV = dI / dV;               // Incremental Conductance
    float diff = dIdV + (fIin / fVin);  // dP/dV = V * (dI/dV + I/V)
    // We check the sign of (dI/dV + I/V) to determine direction.

    if (fabsf(diff) < DIFF_EPS) {
      // dP/dV ~ 0 -> We are at the Maximum Power Point.
    } else if (diff > 0) {
      // dP/dV > 0 -> Left of MPP.
      // Need to increase Voltage -> Decrease Duty (Buck).
      setDuty(duty - step);
    } else {
      // dP/dV < 0 -> Right of MPP.
      // Need to decrease Voltage -> Increase Duty (Buck).
      setDuty(duty + step);
    }
  }
 
  // Save state for next iteration
  prevVin    = fVin;
  prevMetric = fIin;
}

void mpptPerturbObserve(float fVin, float fIin) {
    float pin = fVin * fIin;
    float step = DUTY_STEP_START;
    float duty = getDuty();

    // --- Initialization Phase ---
    if (!have_prev) {
        prevVin    = fVin;
        prevMetric = pin; // Store Power for P&O
        have_prev  = true;
        // Initial kick
        setDuty(duty + FIRST_KICK_STEP); 
        return;
    }

    float dP = pin - prevMetric;
    float dV = fVin - prevVin;

    // --- Algorithm Logic ---
    // We want to climb the hill (increase Power).
    // Direction depends on sign of dP and dV.
    
    // Buck Converter Relationship:
    // Decrease Duty -> Increase Input Voltage
    // Increase Duty -> Decrease Input Voltage

    if (dP > 0) {
        // Power Increased: We are moving in the right direction.
        if (dV > 0) {
            // Voltage increased and Power increased.
            // We are on the Left slope, climbing up.
            // Action: Continue increasing Voltage -> Decrease Duty.
            setDuty(duty - step);
        } else {
            // Voltage decreased and Power increased.
            // We are on the Right slope, climbing up (moving left).
            // Action: Continue decreasing Voltage -> Increase Duty.
            setDuty(duty + step);
        }
    } else {
        // Power Decreased: We moved in the wrong direction (passed peak or went wrong way).
        if (dV > 0) {
            // Voltage increased but Power decreased.
            // We are on the Right slope, moving further right (downhill).
            // Action: Reverse direction (Decrease Voltage) -> Increase Duty.
            setDuty(duty + step);
        } else {
            // Voltage decreased but Power decreased.
            // We are on the Left slope, moving further left (downhill).
            // Action: Reverse direction (Increase Voltage) -> Decrease Duty.
            setDuty(duty - step);
        }
    }

    // Save state for next iteration
    prevVin    = fVin;
    prevMetric = pin;
}
