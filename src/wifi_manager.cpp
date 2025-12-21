#ifdef ESP32
#include "wifi_manager.h"
#include "config.h"
#include "pwm_manager.h"
#include "sweep_manager.h"
#include <Arduino.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <ArduinoJson.h>
#include <LittleFS.h>

// Externs from main.cpp
extern float fVin, fIin, fPin;
extern Mode mode;
extern Algorithm currentAlgorithm;

AsyncWebServer server(WEB_PORT);
AsyncWebSocket ws("/ws");

void broadcastMpptData(float v, float i, float p) {
    if (ws.count() == 0) return;
    String json = "{\"v\":" + String(v, 2) + ",\"i\":" + String(i, 2) + ",\"p\":" + String(p, 2) + "}";
    ws.textAll(json);
}

void setupWiFi() {
  // Start Open Access Point (No Password)
  WiFi.softAP(WIFI_SSID);
  Serial.print("AP IP Address: ");
  Serial.println(WiFi.softAPIP());

  if(!LittleFS.begin()){
    Serial.println("An Error has occurred while mounting LittleFS");
  } else {
    server.serveStatic("/", LittleFS, "/").setDefaultFile("index.html");
  }

  ws.onEvent([](AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type, void *arg, uint8_t *data, size_t len){
      // Handle WebSocket events if needed
  });
  server.addHandler(&ws);

  server.on("/api/data", HTTP_GET, [](AsyncWebServerRequest *request){
    String json = "{";
    json += "\"vin\":" + String(fVin, 2) + ",";
    json += "\"iin\":" + String(fIin, 2) + ",";
    json += "\"pin\":" + String(fPin, 2) + ",";
    json += "\"duty\":" + String(getDuty() * 100, 1) + ",";
    json += "\"mode\":\"" + String(mode == MODE_AUTO ? "AUTO" : "MANUAL") + "\",";
    json += "\"algo\":\"" + String(currentAlgorithm == ALGORITHM_INCCOND ? "INCCOND" : "PNO") + "\"";
    json += "}";
    request->send(200, "application/json", json);
  });

  server.on("/api/set", HTTP_GET, [](AsyncWebServerRequest *request){
    if (request->hasParam("mode")) {
        String m = request->getParam("mode")->value();
        if (m == "AUTO") mode = MODE_AUTO;
        else if (m == "MANUAL") mode = MODE_MANUAL;
    }
    if (request->hasParam("algo")) {
        String a = request->getParam("algo")->value();
        if (a == "INCCOND") currentAlgorithm = ALGORITHM_INCCOND;
        else if (a == "PNO") currentAlgorithm = ALGORITHM_PNO;
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

  server.begin();
}

void handleWiFi() {
    ws.cleanupClients();
}

#endif
