#pragma once

#ifdef ESP32
#include <WiFi.h>
#include <ESPAsyncWebServer.h>
#include "config.h"

void setupWiFi();
void handleWiFi();
void broadcastMpptData(float v, float i, float p);
void broadcastSweepDone();
void setWebMode(Mode requestedMode);
void setWebAlgorithm(Algorithm requestedAlgorithm);
void setWebDuty(float duty);
void clearWebManualDuty();
bool isWebManualDutyActive();
float getWebManualDuty();

#endif
