#pragma once
#if defined(ESP32)
#include <ESPAsyncWebServer.h>
void setupLogRoutes(AsyncWebServer &server);
#endif
