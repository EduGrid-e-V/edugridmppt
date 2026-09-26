#if defined(ESP32)

#include "log_web.h"
#include "log_manager.h"
#include "ota_manager.h"
#include "config.h"
#include <LittleFS.h>

namespace {
const char DOWNLOADS_PAGE[] PROGMEM = R"HTML(
<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>EduGrid recordings</title>
<style>
:root{font-family:system-ui,sans-serif;color:#17242b;background:#eef4f1}
body{margin:0;padding:24px}.wrap{max-width:840px;margin:auto}
header,.card{background:white;border:1px solid #c9d8d1;border-radius:10px;padding:20px;margin-bottom:14px}
h1,h2{margin-top:0}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px;border-bottom:1px solid #dde7e2}
button{padding:7px 11px;cursor:pointer}a{color:#147b57}.muted{color:#52645d}
</style></head><body><main class="wrap">
<header><p><a href="/">&larr; Dashboard</a></p><h1>Experiment recordings</h1>
<p>CSV columns: elapsed seconds, PV voltage/current, load voltage/current, duty cycle. Blank load cells mean the load sensor was unavailable.</p>
<p class="muted">Recordings use up to 4 MiB of LittleFS. A filesystem update can erase them, so download any CSV you want to keep first.</p>
<p id="usage">Loading storage...</p></header>
<section class="card"><h2>CSV files</h2><table><thead><tr><th>Recording</th><th>Size</th><th>Action</th></tr></thead><tbody id="files"></tbody></table>
<p id="message" role="status"></p></section></main>
<script>
async function refresh(){const r=await fetch('/api/logging');const s=await r.json();
document.querySelector('#usage').textContent=(s.usedBytes/1048576).toFixed(2)+' / '+(s.budgetBytes/1048576).toFixed(1)+' MiB log budget used; '+(s.freeBytes/1048576).toFixed(2)+' MiB free in LittleFS.';
const body=document.querySelector('#files');body.replaceChildren();
for(const f of s.files){const tr=document.createElement('tr'),name=document.createElement('td'),size=document.createElement('td'),action=document.createElement('td');
name.textContent=f.name+(s.recording&&f.name===s.active?' (recording)':'');size.textContent=(f.bytes/1024).toFixed(1)+' KiB';
if(s.recording&&f.name===s.active){action.textContent='Stop recording to download';}
else{const a=document.createElement('a');a.href='/api/logging/file?name='+encodeURIComponent(f.name);a.download=f.name;a.textContent='Download';action.append(a);
const del=document.createElement('button');del.textContent='Delete';del.onclick=async()=>{if(!confirm('Delete '+f.name+'?'))return;const res=await fetch('/api/logging/file?name='+encodeURIComponent(f.name),{method:'DELETE'});document.querySelector('#message').textContent=res.ok?'Deleted.':'Could not delete this recording.';refresh()};action.append(' ',del);}
tr.append(name,size,action);body.append(tr)}
if(!s.files.length){const tr=document.createElement('tr');tr.innerHTML='<td colspan="3">No recordings yet.</td>';body.append(tr)}
}
refresh().catch(()=>document.querySelector('#usage').textContent='Could not read logger status.');
</script></body></html>
)HTML";
}

void setupLogRoutes(AsyncWebServer &server) {
    server.on("/downloads", HTTP_GET, [](AsyncWebServerRequest *request) {
        request->send(200, "text/html; charset=utf-8", DOWNLOADS_PAGE);
    });
    server.on("/api/logging", HTTP_GET, [](AsyncWebServerRequest *request) {
        request->send(200, "application/json", logStatusJson());
    });
    server.on("/api/logging/start", HTTP_POST, [](AsyncWebServerRequest *request) {
        unsigned seconds = request->hasParam("intervalS")
            ? request->getParam("intervalS")->value().toInt() : 0;
        if (isOtaSafetyActive()) {
            request->send(409, "application/json", "{\"message\":\"Update in progress\"}");
            return;
        }
        String message;
        bool started = startLogRecording(seconds, message);
        request->send(started ? 200 : 409, "application/json", logStatusJson());
    });
    server.on("/api/logging/stop", HTTP_POST, [](AsyncWebServerRequest *request) {
        stopLogRecording();
        request->send(200, "application/json", logStatusJson());
    });
    server.on("/api/logging/file", HTTP_GET,
        [](AsyncWebServerRequest *request) {
            if (isOtaSafetyActive()) {
                request->send(503, "text/plain", "Filesystem update in progress");
                return;
            }
            String name = request->hasParam("name") ? request->getParam("name")->value() : String();
            String path = logFilePath(name);
            if (path.isEmpty() || !LittleFS.exists(path)) {
                request->send(404, "text/plain", "Not found");
                return;
            }
            request->send(LittleFS, path, "text/csv", true);
        });
    server.on("/api/logging/file", HTTP_DELETE,
        [](AsyncWebServerRequest *request) {
            if (isOtaSafetyActive()) {
                request->send(409, "application/json", "{\"message\":\"Update in progress\"}");
                return;
            }
            request->send(deleteLogRecording(request->hasParam("name") ? request->getParam("name")->value() : String()) ? 200 : 409,
                          "application/json", logStatusJson());
        });
}

#endif
