/**
 * @file ota_manager.cpp
 * @brief Embedded recovery page and streamed OTA update handlers.
 */

#ifdef ESP32

#include "ota_manager.h"

#include "config.h"
#include "pwm_manager.h"
#include "sweep_manager.h"
#include "log_manager.h"

#include <Arduino.h>
#include <LittleFS.h>
#include <Preferences.h>
#include <Update.h>
#include <WiFi.h>
#include <esp_ota_ops.h>
#include <new>

namespace {

constexpr char STUDENT_PROGRAM_PATH[] = "/student.be";
constexpr char PREFERENCES_NAMESPACE[] = "edugrid_ota";
constexpr char PROGRAM_BACKUP_KEY[] = "student_be";
constexpr char PROGRAM_PENDING_KEY[] = "restore_be";
constexpr size_t MAX_PROGRAM_BACKUP_BYTES = 4096;
constexpr unsigned long UPLOAD_TIMEOUT_MS = 30000UL;
constexpr unsigned long REBOOT_DELAY_MS = 1800UL;

bool updateInProgress = false;
bool rebootPending = false;
bool updatingFileSystem = false;
bool fileSystemIsMounted = false;
unsigned long lastUploadActivityMs = 0;
unsigned long rebootAtMs = 0;
String lastUpdateResult = "No update attempted since boot.";

const char ADMIN_PAGE[] PROGMEM = R"HTML(
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>EduGrid update</title>
<style>
:root{font-family:system-ui,sans-serif;color:#17242b;background:#eef4f1}body{margin:0;padding:24px}.wrap{max-width:760px;margin:auto}header,.card{background:#fff;border:1px solid #c9d8d1;border-radius:12px;padding:20px;margin-bottom:16px}h1,h2{margin-top:0}h1{font-size:1.7rem}.muted{color:#52645d}.warning{background:#fff6df;border-left:4px solid #c78400;padding:12px}label{display:block;font-weight:700;margin:12px 0 6px}input[type=file]{width:100%;box-sizing:border-box;border:1px solid #9eb1a8;border-radius:6px;padding:10px}button{margin-top:12px;background:#147b57;color:#fff;border:0;border-radius:6px;padding:11px 16px;font-weight:700;cursor:pointer}button:disabled{opacity:.55;cursor:wait}progress{display:block;width:100%;height:20px;margin-top:12px}.result{white-space:pre-wrap;margin-top:10px}.back{color:#147b57}.danger button{background:#a33b2b}</style>
</head>
<body><main class="wrap">
<header><p><a class="back" href="/">&larr; Dashboard</a></p><h1>EduGrid recovery and updates</h1><p class="muted">This page is built into the firmware. It remains available even if the dashboard filesystem is damaged.</p><p class="warning">No password is required. Anyone connected to the open EduGrid WiFi can install firmware or replace the dashboard filesystem.</p><div id="status">Loading device status...</div></header>
<section class="card"><h2>1. Firmware</h2><p>Uploads <code>firmware.bin</code> to the inactive application slot. The currently running firmware is not overwritten.</p><form action="/admin/update/firmware" method="post" enctype="multipart/form-data"><label for="firmware">Firmware image</label><input id="firmware" name="image" type="file" accept=".bin,application/octet-stream" required><button type="submit">Install firmware and restart</button><progress value="0" max="100" hidden></progress><div class="result"></div></form></section>
<section class="card"><h2>2. Dashboard filesystem</h2><p>Uploads <code>littlefs.bin</code>. This replaces the complete dashboard filesystem. A saved <code>/student.be</code> program is backed up separately and restored after a successful upload. Experiment CSV recordings are not backed up; download them from <a href="/downloads">/downloads</a> first if you want to keep them.</p><p class="warning"><strong>Keep power connected.</strong> Unlike application OTA, the filesystem has no second slot. If this upload is interrupted, return to this recovery page and upload the filesystem again.</p><form action="/admin/update/filesystem" method="post" enctype="multipart/form-data"><label for="filesystem">LittleFS image</label><input id="filesystem" name="image" type="file" accept=".bin,application/octet-stream" required><button type="submit">Replace filesystem and restart</button><progress value="0" max="100" hidden></progress><div class="result"></div></form></section>
</main>
<script>
const status=document.querySelector('#status');
fetch('/admin/status').then(r=>r.json()).then(s=>{status.innerHTML=`<strong>${s.board}</strong><br>Firmware: ${s.firmware}<br>Running slot: ${s.partition}<br>Filesystem: ${s.filesystem}<br>Last result: ${s.result}`}).catch(()=>status.textContent='Could not read device status.');
document.querySelectorAll('form').forEach(form=>form.addEventListener('submit',event=>{event.preventDefault();const file=form.querySelector('input').files[0];if(!file)return;if(!confirm('Install '+file.name+'? Keep the board powered until it restarts.'))return;const button=form.querySelector('button'),progress=form.querySelector('progress'),result=form.querySelector('.result'),body=new FormData(form),xhr=new XMLHttpRequest();button.disabled=true;progress.hidden=false;result.textContent='Uploading...';xhr.upload.onprogress=e=>{if(e.lengthComputable)progress.value=e.loaded/e.total*100};xhr.onload=()=>{document.open();document.write(xhr.responseText);document.close()};xhr.onerror=()=>{button.disabled=false;result.textContent='Upload connection failed. The recovery page is still available; reload and try again.'};xhr.open('POST',form.action);xhr.send(body)}));
</script></body></html>
)HTML";

String jsonEscape(const String& value) {
    String escaped;
    escaped.reserve(value.length() + 8);
    for (size_t index = 0; index < value.length(); ++index) {
        char character = value[index];
        if (character == '\\' || character == '"') {
            escaped += '\\';
        }
        if (character == '\n') {
            escaped += "\\n";
        } else if (character != '\r') {
            escaped += character;
        }
    }
    return escaped;
}

String updateResultPage(bool succeeded, const String& message) {
    String page;
    page.reserve(900);
    page += F("<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">");
    page += F("<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">");
    if (succeeded) {
        page += F("<meta http-equiv=\"refresh\" content=\"8;url=/admin\">");
    }
    page += F("<title>EduGrid update</title><style>body{font-family:system-ui,sans-serif;max-width:650px;margin:3rem auto;padding:1rem;color:#17242b}article{border:1px solid #c9d8d1;border-radius:12px;padding:2rem}a{color:#147b57}</style></head><body><article>");
    page += succeeded ? F("<h1>Update installed</h1><p>") : F("<h1>Update failed</h1><p>");
    page += message;
    page += F("</p>");
    if (succeeded) {
        page += F("<p>The controller is restarting. This page will try to reconnect in a few seconds.</p>");
    } else {
        page += F("<p><a href=\"/admin\">Return to the recovery page</a></p>");
    }
    page += F("</article></body></html>");
    return page;
}

void backUpStudentProgram() {
    // Keep an older pending backup when LittleFS is already damaged. This lets
    // a later retry restore the program after a valid filesystem is installed.
    if (!fileSystemIsMounted || !LittleFS.exists(STUDENT_PROGRAM_PATH)) return;

    File program = LittleFS.open(STUDENT_PROGRAM_PATH, "r");
    if (!program) return;

    size_t programSize = program.size();
    if (programSize == 0 || programSize > MAX_PROGRAM_BACKUP_BYTES) {
        program.close();
        Serial.println(F("OTA: student.be not backed up (empty or larger than 4096 bytes)"));
        return;
    }

    uint8_t* bytes = new (std::nothrow) uint8_t[programSize];
    if (bytes == nullptr) {
        program.close();
        Serial.println(F("OTA: not enough memory to back up student.be"));
        return;
    }

    size_t bytesRead = program.read(bytes, programSize);
    program.close();

    Preferences preferences;
    if (bytesRead == programSize && preferences.begin(PREFERENCES_NAMESPACE, false)) {
        bool stored = preferences.putBytes(PROGRAM_BACKUP_KEY, bytes, programSize) == programSize;
        if (stored) preferences.putBool(PROGRAM_PENDING_KEY, true);
        preferences.end();
        Serial.println(stored ? F("OTA: student.be backed up")
                              : F("OTA: failed to back up student.be"));
    }
    delete[] bytes;
}

bool restoreStudentProgramIfNeeded() {
    if (!fileSystemIsMounted) return false;

    Preferences preferences;
    if (!preferences.begin(PREFERENCES_NAMESPACE, false)) return false;
    bool pending = preferences.getBool(PROGRAM_PENDING_KEY, false);
    size_t programSize = preferences.getBytesLength(PROGRAM_BACKUP_KEY);
    if (!pending || programSize == 0 || programSize > MAX_PROGRAM_BACKUP_BYTES) {
        preferences.end();
        return true;
    }

    uint8_t* bytes = new (std::nothrow) uint8_t[programSize];
    if (bytes == nullptr) {
        preferences.end();
        return false;
    }

    bool readSucceeded = preferences.getBytes(PROGRAM_BACKUP_KEY, bytes, programSize) == programSize;
    bool writeSucceeded = false;
    if (readSucceeded) {
        File program = LittleFS.open(STUDENT_PROGRAM_PATH, "w");
        if (program) {
            writeSucceeded = program.write(bytes, programSize) == programSize;
            program.close();
        }
    }
    delete[] bytes;

    if (writeSucceeded) {
        preferences.remove(PROGRAM_BACKUP_KEY);
        preferences.remove(PROGRAM_PENDING_KEY);
        Serial.println(F("OTA: student.be restored"));
    }
    preferences.end();
    return writeSucceeded;
}

void makeConverterSafe() {
    stopLogRecording();
    cancelSweep();
    setDuty(PWM_MIN_DUTY);
}

void finishFailedUpload(const String& message) {
    if (Update.isRunning()) Update.abort();
    if (updatingFileSystem && !fileSystemIsMounted) {
        fileSystemIsMounted = LittleFS.begin(false);
        setupLogManager(fileSystemIsMounted);
    }
    updateInProgress = false;
    updatingFileSystem = false;
    lastUpdateResult = message;
    Serial.print(F("OTA failed: "));
    Serial.println(message);
}

void beginUpload(AsyncWebServerRequest* request, bool fileSystemUpdate) {
    request->setAttribute("otaAccepted", false);
    if (updateInProgress || rebootPending) {
        request->setAttribute("otaError", "Another update is already running.");
        return;
    }

    updateInProgress = true;
    lastUploadActivityMs = millis();
    makeConverterSafe();
    updatingFileSystem = fileSystemUpdate;
    if (fileSystemUpdate) {
        backUpStudentProgram();
        if (fileSystemIsMounted) {
            setupLogManager(false);
            LittleFS.end();
            fileSystemIsMounted = false;
        }
    }

    int updateTarget = fileSystemUpdate ? U_SPIFFS : U_FLASH;
    if (!Update.begin(UPDATE_SIZE_UNKNOWN, updateTarget)) {
        String error = String("Could not start update: ") + Update.errorString();
        request->setAttribute("otaError", error);
        finishFailedUpload(error);
        return;
    }

    request->setAttribute("otaAccepted", true);
    Serial.println(fileSystemUpdate ? F("OTA: filesystem upload started")
                                    : F("OTA: firmware upload started"));
}

void receiveUpload(AsyncWebServerRequest* request,
                   bool fileSystemUpdate,
                   size_t index,
                   uint8_t* data,
                   size_t length,
                   bool final) {
    if (index == 0) beginUpload(request, fileSystemUpdate);
    if (!request->getAttribute("otaAccepted", false)) return;

    lastUploadActivityMs = millis();
    if (length > 0 && Update.write(data, length) != length) {
        String error = String("Flash write failed: ") + Update.errorString();
        request->setAttribute("otaError", error);
        request->setAttribute("otaAccepted", false);
        finishFailedUpload(error);
        return;
    }

    if (!final) return;
    if (!Update.end(true)) {
        String error = String("Image validation failed: ") + Update.errorString();
        request->setAttribute("otaError", error);
        request->setAttribute("otaAccepted", false);
        finishFailedUpload(error);
        return;
    }

    if (fileSystemUpdate) {
        fileSystemIsMounted = LittleFS.begin(false);
        setupLogManager(fileSystemIsMounted);
        if (!fileSystemIsMounted) {
            String error = "The image was written but LittleFS could not mount it. Upload a valid filesystem image.";
            request->setAttribute("otaError", error);
            request->setAttribute("otaAccepted", false);
            finishFailedUpload(error);
            return;
        }
        if (!restoreStudentProgramIfNeeded()) {
            Serial.println(F("OTA: filesystem installed, but student.be restore remains pending"));
        }
    }

    updateInProgress = false;
    rebootPending = true;
    rebootAtMs = millis() + REBOOT_DELAY_MS;
    lastUpdateResult = fileSystemUpdate
        ? "Filesystem update installed; restart pending."
        : "Firmware update installed; restart pending.";
    request->setAttribute("otaSucceeded", true);
    Serial.println(lastUpdateResult);
}

void sendUploadResult(AsyncWebServerRequest* request) {
    bool succeeded = request->getAttribute("otaSucceeded", false);
    String message = lastUpdateResult;
    if (!succeeded) {
        message = request->hasAttribute("otaError")
            ? request->getAttribute("otaError")
            : String("No valid update image was received.");
    }
    request->send(succeeded ? 200 : 400,
                  "text/html; charset=utf-8",
                  updateResultPage(succeeded, message));
}

}  // namespace

void setupOtaAdmin(AsyncWebServer& server, bool fileSystemMounted) {
    fileSystemIsMounted = fileSystemMounted;
    restoreStudentProgramIfNeeded();

    Serial.print(F("OTA admin: http://"));
    Serial.print(WiFi.softAPIP());
    Serial.println(F("/admin"));

    server.on("/admin", HTTP_GET, [](AsyncWebServerRequest* request) {
        request->send(200, "text/html; charset=utf-8", ADMIN_PAGE);
    });

    server.on("/admin/status", HTTP_GET, [](AsyncWebServerRequest* request) {
        const esp_partition_t* runningPartition = esp_ota_get_running_partition();
        String json = "{";
        json += "\"board\":\"" + jsonEscape(ESP.getChipModel()) + "\",";
        json += "\"firmware\":\"" __DATE__ " " __TIME__ "\",";
        json += "\"partition\":\"";
        json += runningPartition == nullptr ? "unknown" : runningPartition->label;
        json += "\",";
        json += "\"filesystem\":\"";
        if (fileSystemIsMounted) {
            json += String(LittleFS.usedBytes()) + " / " + String(LittleFS.totalBytes()) + " bytes";
        } else {
            json += "not mounted";
        }
        json += "\",\"result\":\"" + jsonEscape(lastUpdateResult) + "\"}";
        request->send(200, "application/json", json);
    });

    server.on("/admin/update/firmware",
              HTTP_POST,
              sendUploadResult,
              [](AsyncWebServerRequest* request,
                 const String&,
                 size_t index,
                 uint8_t* data,
                 size_t length,
                 bool final) {
                  receiveUpload(request, false, index, data, length, final);
              });

    server.on("/admin/update/filesystem",
              HTTP_POST,
              sendUploadResult,
              [](AsyncWebServerRequest* request,
                 const String&,
                 size_t index,
                 uint8_t* data,
                 size_t length,
                 bool final) {
                  receiveUpload(request, true, index, data, length, final);
              });
}

void handleOtaAdmin() {
    unsigned long now = millis();
    if (updateInProgress && now - lastUploadActivityMs > UPLOAD_TIMEOUT_MS) {
        finishFailedUpload("Upload timed out. You can try again from the recovery page.");
    }
    if (rebootPending && static_cast<long>(now - rebootAtMs) >= 0) {
        makeConverterSafe();
        ESP.restart();
    }
}

bool isOtaSafetyActive() {
    return updateInProgress || rebootPending;
}

#endif
