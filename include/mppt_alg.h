/**
 * @file mppt_alg.h
 * @brief Maximum Power Point Tracking Algorithms.
 *
 * This module implements the MPPT logic. It currently supports:
 * - Incremental Conductance
 * - Perturb & Observe
 */

#pragma once
#include <Arduino.h>

/**
 * @brief Resets the internal state of the MPPT algorithm.
 * 
 * Should be called when switching modes or restarting the MPPT process
 * to ensure a fresh start (e.g., re-triggering the initial kick).
 */
void resetMPPT();

/**
 * @brief Executes one iteration of the Incremental Conductance algorithm.
 * 
 * Calculates the slope of the P-V curve (dI/dV) and compares it with the
 * instantaneous conductance (I/V) to determine the direction of the MPP.
 * Adjusts the PWM duty cycle accordingly.
 * 
 * @param fVin Filtered Input Voltage (V).
 * @param fIin Filtered Input Current (A).
 */
void mpptIncrementalConductance(float fVin, float fIin);

/**
 * @brief Executes one iteration of the Perturb & Observe (P&O) algorithm.
 * 
 * Perturbs the operating point (duty cycle) and observes the change in power.
 * If power increases, continues in the same direction. If power decreases, reverses direction.
 * 
 * @param fVin Filtered Input Voltage (V).
 * @param fIin Filtered Input Current (A).
 */
void mpptPerturbObserve(float fVin, float fIin);
