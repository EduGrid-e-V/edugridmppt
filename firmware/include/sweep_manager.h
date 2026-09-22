#pragma once
#include <Arduino.h>

#ifdef ESP32
void startSweep();
/** @brief Stops an active sweep without changing the converter duty cycle. */
void cancelSweep();
bool updateSweep();
bool isSweeping();
String getSweepData();
#endif
