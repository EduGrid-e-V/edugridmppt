/**
 * @file ota_manager.h
 * @brief Browser-based firmware and LittleFS updates for ESP32 builds.
 */

#pragma once

#ifdef ESP32

#include <ESPAsyncWebServer.h>

/**
 * @brief Adds the embedded OTA administration routes to a web server.
 *
 * @param server Dashboard web server that owns the routes.
 * @param fileSystemMounted true when LittleFS mounted successfully at startup.
 */
void setupOtaAdmin(AsyncWebServer& server, bool fileSystemMounted);

/** @brief Services update timeouts and delayed reboots. */
void handleOtaAdmin();

/**
 * @brief Reports whether normal converter control must remain disabled.
 *
 * @return true during an upload and while waiting to reboot after an update.
 */
bool isOtaSafetyActive();

#endif
