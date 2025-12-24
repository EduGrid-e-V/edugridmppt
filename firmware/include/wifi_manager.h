#pragma once

#ifdef ESP32
#include <WiFi.h>
#include <ESPAsyncWebServer.h>

void setupWiFi();
void handleWiFi();
void broadcastMpptData(float v, float i, float p);

#endif
