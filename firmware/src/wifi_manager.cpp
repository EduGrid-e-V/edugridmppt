#ifdef ESP32
#include "wifi_manager.h"
#include "config.h"
#include "input_manager.h"
#include "mppt_alg.h"
#include "sweep_manager.h"
#include "berry_manager.h"
#include "ota_manager.h"
#include "log_manager.h"
#include "log_web.h"
#include <Arduino.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <ArduinoJson.h>
#include <LittleFS.h>
#include <DNSServer.h>
#include <stdlib.h>
#include <string.h>

// Measurements from main.cpp
extern float PanelVoltage;
extern float PanelCurrent;
extern float PanelPower;
extern float LoadVoltage;
extern float LoadCurrent;
extern float LoadPower;
extern bool LoadSensorAvailable;
extern Mode mode;
extern Algorithm currentAlgorithm;

AsyncWebServer server(WEB_PORT);
AsyncWebSocket ws("/ws");
DNSServer dnsServer;

static bool webManualDutyActive = false;
static float webManualDuty = PWM_MIN_DUTY;
static char wifiAccessPointSsid[16] = "";
static bool captivePortalIsRunning = false;

static const char *algorithmName(Algorithm algorithm) {
    if (algorithm == ALGORITHM_INCCOND) return "INCCOND";
    if (algorithm == ALGORITHM_BERRY) return "STUDENT";
    return "PNO";
}

static void sendBerryJson(AsyncWebServerRequest *request, int status, bool success,
                          const String &message, bool includeSource = false) {
    JsonDocument document;
    document["ok"] = success;
    document["installed"] = isBerryProgramInstalled();
    document["healthy"] = isBerryProgramHealthy();
    document["diagnostic"] = message;
    if (includeSource) document["source"] = getBerrySource();
    String json;
    serializeJson(document, json);
    request->send(status, "application/json", json);
}

static void buildWiFiSsid() {
    // Arduino stores the MAC octets little-endian in this uint64_t value.
    // Byte 5 is the final octet of the printed base MAC address.
    uint8_t chipIdSuffix = (uint8_t)((ESP.getEfuseMac() >> 40) & 0xFF);
    snprintf(wifiAccessPointSsid,
             sizeof(wifiAccessPointSsid),
             "%s%02X",
             WIFI_SSID_PREFIX,
             chipIdSuffix);
}

const char* getWiFiSsid() {
    if (wifiAccessPointSsid[0] == '\0') {
        buildWiFiSsid();
    }

    return wifiAccessPointSsid;
}

static String dashboardUrl() {
    return String("http://") + WiFi.softAPIP().toString() + "/";
}

static void redirectToDashboard(AsyncWebServerRequest* request) {
    request->redirect(dashboardUrl());
}

static void sendNotFoundOrDashboard(AsyncWebServerRequest* request) {
    String path = request->url();

    if (path.startsWith("/api/")) {
        request->send(404, "application/json", "{\"error\":\"not found\"}");
        return;
    }

    redirectToDashboard(request);
}

static void setupCaptivePortalRoutes() {
    server.on("/generate_204", HTTP_GET, redirectToDashboard);
    server.on("/gen_204", HTTP_GET, redirectToDashboard);
    server.on("/hotspot-detect.html", HTTP_GET, redirectToDashboard);
    server.on("/library/test/success.html", HTTP_GET, redirectToDashboard);
    server.on("/ncsi.txt", HTTP_GET, redirectToDashboard);
    server.on("/connecttest.txt", HTTP_GET, redirectToDashboard);
    server.on("/redirect", HTTP_GET, redirectToDashboard);
    server.on("/canonical.html", HTTP_GET, redirectToDashboard);
    server.on("/success.txt", HTTP_GET, redirectToDashboard);
    server.on("/fwlink", HTTP_GET, redirectToDashboard);
    server.onNotFound(sendNotFoundOrDashboard);
}

void broadcastMpptData(float v, float i, float p) {
    if (ws.count() == 0) return;
    String json = "{";
    json += "\"v\":" + String(v, 2) + ",";
    json += "\"i\":" + String(i, 4) + ",";
    json += "\"p\":" + String(p, 2) + ",";
    json += "\"loadV\":" + String(LoadVoltage, 2) + ",";
    json += "\"loadI\":" + String(LoadCurrent, 4) + ",";
    json += "\"loadP\":" + String(LoadPower, 2) + ",";
    json += "\"loadSensor\":" + String(LoadSensorAvailable ? "true" : "false") + ",";
    json += "\"d\":" + String(getConverterDutyCycle(), 3) + ",";
    json += "\"pot\":" + String(readPotentiometerRaw()) + ",";
    json += "\"m\":\"" + String(mode == MODE_AUTO ? "AUTO" : "MANUAL") + "\",";
    json += "\"algo\":\"" + String(algorithmName(currentAlgorithm)) + "\",";
    json += "\"berryHealthy\":" + String(isBerryProgramHealthy() ? "true" : "false");
    json += "}";
    ws.textAll(json);
}

void broadcastSweepDone() {
    if (ws.count() == 0) return;
    ws.textAll("{\"event\":\"sweep_done\"}");
}

void setWebMode(Mode requestedMode) {
    mode = requestedMode;
    if (requestedMode == MODE_MANUAL) {
        webManualDutyActive = false;
    } else {
        webManualDutyActive = false;
    }
}

void setWebAlgorithm(Algorithm requestedAlgorithm) {
    currentAlgorithm = requestedAlgorithm;
    resetMPPT();
    if (requestedAlgorithm == ALGORITHM_BERRY) resetBerryMppt();
}

void setWebDuty(float duty) {
    webManualDutyActive = true;
    webManualDuty = constrain(duty, PWM_MIN_DUTY, PWM_MAX_DUTY);
    mode = MODE_MANUAL;
    rememberCurrentPotentiometerPositionAsBaseline();
    setConverterDutyCycle(webManualDuty);
}

void clearWebManualDuty() {
    webManualDutyActive = false;
}

bool isWebManualDutyActive() {
    return webManualDutyActive;
}

float getWebManualDuty() {
    return webManualDuty;
}

void setupWiFi() {
  // Start Open Access Point (No Password)
  const char* ssid = getWiFiSsid();
  WiFi.softAP(ssid);
  Serial.print("WiFi SSID: ");
  Serial.println(ssid);
  Serial.print("AP IP Address: ");
  Serial.println(WiFi.softAPIP());

  captivePortalIsRunning = dnsServer.start(CAPTIVE_DNS_PORT,
                                           "*",
                                           WiFi.softAPIP());
  Serial.print("Captive portal DNS: ");
  Serial.println(captivePortalIsRunning ? "started" : "failed");

  bool fileSystemMounted = LittleFS.begin(false);
  if(!fileSystemMounted){
    Serial.println("An Error has occurred while mounting LittleFS");
  }

  setupLogManager(fileSystemMounted);
  setupLogRoutes(server);
  setupOtaAdmin(server, fileSystemMounted);

  if(fileSystemMounted){
    server.serveStatic("/", LittleFS, "/").setDefaultFile("index.html");
  }

  ws.onEvent([](AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type, void *arg, uint8_t *data, size_t len){
      // Handle WebSocket events if needed
  });
  server.addHandler(&ws);

  server.on("/api/data", HTTP_GET, [](AsyncWebServerRequest *request){
    String json = "{";
    json += "\"vin\":" + String(PanelVoltage, 2) + ",";
    json += "\"iin\":" + String(PanelCurrent, 4) + ",";
    json += "\"pin\":" + String(PanelPower, 2) + ",";
    json += "\"loadV\":" + String(LoadVoltage, 2) + ",";
    json += "\"loadI\":" + String(LoadCurrent, 4) + ",";
    json += "\"loadP\":" + String(LoadPower, 2) + ",";
    json += "\"loadSensor\":" + String(LoadSensorAvailable ? "true" : "false") + ",";
    json += "\"duty\":" + String(getConverterDutyCycle() * 100, 1) + ",";
    json += "\"pot\":" + String(readPotentiometerRaw()) + ",";
    json += "\"mode\":\"" + String(mode == MODE_AUTO ? "AUTO" : "MANUAL") + "\",";
    json += "\"algo\":\"" + String(algorithmName(currentAlgorithm)) + "\",";
    json += "\"berryHealthy\":" + String(isBerryProgramHealthy() ? "true" : "false");
    json += "}";
    request->send(200, "application/json", json);
  });

  server.on("/api/set", HTTP_GET, [](AsyncWebServerRequest *request){
    if (request->hasParam("mode")) {
        String m = request->getParam("mode")->value();
        if (m == "AUTO") setWebMode(MODE_AUTO);
        else if (m == "MANUAL") setWebMode(MODE_MANUAL);
    }
    if (request->hasParam("algo")) {
        String a = request->getParam("algo")->value();
        if (a == "INCCOND") setWebAlgorithm(ALGORITHM_INCCOND);
        else if (a == "PNO") setWebAlgorithm(ALGORITHM_PNO);
        else if (a == "STUDENT") setWebAlgorithm(ALGORITHM_BERRY);
    }
    if (request->hasParam("duty")) {
        setWebDuty(request->getParam("duty")->value().toFloat());
    }
    request->send(200, "text/plain", "OK");
  });

  server.on("/api/sweep", HTTP_GET, [](AsyncWebServerRequest *request){
      startSweep();
      request->send(200, "text/plain", "Sweep Started");
  });
  
  server.on("/api/sweepdata", HTTP_GET, [](AsyncWebServerRequest *request){
      request->send(200, "application/json", getSweepData());
  });

  server.on("/api/berry", HTTP_GET, [](AsyncWebServerRequest *request){
      sendBerryJson(request, 200, isBerryProgramHealthy(), getBerryDiagnostic(), true);
  });

  server.on("/api/berry", HTTP_DELETE, [](AsyncWebServerRequest *request){
      disableBerryProgram();
      if (currentAlgorithm == ALGORITHM_BERRY) currentAlgorithm = ALGORITHM_PNO;
      sendBerryJson(request, 200, true, getBerryDiagnostic());
  });

  server.on("/api/berry", HTTP_POST,
    [](AsyncWebServerRequest *request){
      if (request->contentType() != "application/octet-stream") {
          sendBerryJson(request, 415, false, "Berry upload must use application/octet-stream");
          return;
      }
      const size_t length = request->contentLength();
      if (length == 0) {
          sendBerryJson(request, 400, false, "Request body is empty");
          return;
      }
      if (length > BERRY_SOURCE_MAX_BYTES) {
          sendBerryJson(request, 413, false, "Program exceeds the 4096-byte limit");
          return;
      }
      char *source = static_cast<char *>(request->_tempObject);
      if (source == nullptr) {
          sendBerryJson(request, 503, false, "Berry upload buffer unavailable");
          return;
      }
      bool complete = !request->getAttribute("berryBodyInvalid", false) &&
                      request->getAttribute("berryBytesReceived", 0L) == static_cast<long>(length);
      bool hasNul = complete && memchr(source, '\0', length) != nullptr;
      String diagnostic;
      bool installed = complete && !hasNul && installBerryProgram(source, length, diagnostic);
      if (!complete) diagnostic = "Berry upload body is incomplete";
      else if (hasNul) diagnostic = "Berry source contains a NUL byte";
      free(source);
      request->_tempObject = nullptr;
      sendBerryJson(request, installed ? 200 : complete && !hasNul ? 422 : 400,
                    installed, diagnostic);
    },
    nullptr,
    [](AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total){
      if (index == 0) {
          if (request->contentType() != "application/octet-stream" ||
              total == 0 || total > BERRY_SOURCE_MAX_BYTES) return;
          // The web server frees _tempObject on disconnect, so it must use malloc.
          request->_tempObject = malloc(total + 1);
      }
      char *source = static_cast<char *>(request->_tempObject);
      if (source == nullptr) return;
      if (index > total || len > total - index ||
          index != static_cast<size_t>(request->getAttribute("berryBytesReceived", 0L))) {
          request->setAttribute("berryBodyInvalid", true);
          return;
      }
      memcpy(source + index, data, len);
      source[index + len] = '\0';
      request->setAttribute("berryBytesReceived", static_cast<long>(index + len));
    });

  setupCaptivePortalRoutes();
  server.begin();
}

void handleWiFi() {
    handleOtaAdmin();

    if (captivePortalIsRunning) {
        dnsServer.processNextRequest();
    }

    ws.cleanupClients();
}

#endif
