/**
 * @file mppt_alg_reference.h
 * @brief Teacher/demo reference implementation of Perturb and Observe.
 */

#pragma once

#include "mppt_alg.h"

/** @brief Clears the reference P&O algorithm's previous measurement. */
void resetReferencePerturbObserve();

/** @brief Runs one step of the teacher/demo reference P&O algorithm. */
void runReferencePerturbObserve(const SolarPanelMeasurement& measurement);
