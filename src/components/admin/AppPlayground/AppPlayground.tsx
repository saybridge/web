import { useState, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { PageHeader } from '@saybridge/ui';
import './AppPlayground.css';

const DEFAULT_SOURCE = `//go:build tinygo

// My Plugin — WASM Plugin
// Build: tinygo build -o plugin.wasm -target wasi ./
package main

import (
	"strings"
	"unsafe"
)

//go:wasmimport host host_log
func hostLog(level uint32, msgPtr uint32, msgLen uint32)

//go:wasmimport host host_send_message
func hostSendMessage(roomPtr, roomLen, msgPtr, msgLen uint32) int32

//go:wasmimport host host_kv_get
func hostKVGet(keyPtr, keyLen uint32) uint64

//go:wasmimport host host_kv_set
func hostKVSet(keyPtr, keyLen, valPtr, valLen uint32) int32

//go:wasmimport host host_publish_ws_event
func hostPublishWSEvent(roomPtr, roomLen, eventPtr, eventLen, dataPtr, dataLen uint32) int32

var allocBuf []byte

//export malloc
func malloc(size uint32) uint32 {
	allocBuf = make([]byte, size)
	return uint32(uintptr(unsafe.Pointer(&allocBuf[0])))
}

//export on_hook
func onHook(eventPtr, eventLen, payloadPtr, payloadLen uint32) int32 {
	event := ptrToString(eventPtr, eventLen)
	payload := ptrToString(payloadPtr, payloadLen)

	if event == "message.after_send" {
		content := getJsonStringField(payload, "content")
		roomID := getJsonStringField(payload, "room_id")
		logInfo("Received message: " + content)
		sendMessage(roomID, "Echo: " + content)
		return 0
	}

	return 0
}

func sendMessage(room, msg string) {
	roomBytes := []byte(room)
	msgBytes := []byte(msg)
	hostSendMessage(
		uint32(uintptr(unsafe.Pointer(&roomBytes[0]))), uint32(len(roomBytes)),
		uint32(uintptr(unsafe.Pointer(&msgBytes[0]))), uint32(len(msgBytes)),
	)
}

func logInfo(msg string) {
	msgBytes := []byte(msg)
	hostLog(1, uint32(uintptr(unsafe.Pointer(&msgBytes[0]))), uint32(len(msgBytes)))
}

func ptrToString(ptr, length uint32) string {
	if length == 0 { return "" }
	return unsafe.String((*byte)(unsafe.Pointer(uintptr(ptr))), length)
}

func unpackString(val uint64) string {
	if val == 0 { return "" }
	ptr := uint32(val >> 32)
	length := uint32(val & 0xffffffff)
	return ptrToString(ptr, length)
}

func getJsonStringField(json, field string) string {
	key := "\\"" + field + "\\":"
	idx := strings.Index(json, key)
	if idx == -1 { return "" }
	start := idx + len(key)
	for start < len(json) && (json[start] == ' ' || json[start] == ':') { start++ }
	if start >= len(json) { return "" }
	if json[start] == '"' {
		start++
		end := start
		for end < len(json) && json[end] != '"' { end++ }
		if end < len(json) { return json[start:end] }
	}
	return ""
}

func main() {}
`;

const PRESET_EVENTS = [
  { label: 'Message Sent', event: 'message.after_send', payload: '{"sender_id":"user-1","room_id":"general","message_id":"msg-001","content":"Hello World!","room_type":"channel","room_members_count":"5"}' },
  { label: 'Slash Command /ai', event: 'message.slash_command', payload: '{"command":"ai","args":"What is Saybridge?","room_id":"general","sender_id":"user-1"}' },
  { label: 'User Status Change', event: 'user.status_change', payload: '{"user_id":"user-1","old_status":"offline","new_status":"online"}' },
  { label: 'Room Created', event: 'room.after_create', payload: '{"room_id":"room-1","creator_id":"user-1","name":"new-room","room_type":"channel"}' },
  { label: 'Member Joined', event: 'room.member_join', payload: '{"room_id":"room-1","user_id":"user-2","operator_id":"user-1"}' },
];

interface LogEntry {
  level: string;
  message: string;
}

interface SentMessage {
  room_id: string;
  content: string;
}

interface WSEvent {
  room_id: string;
  event: string;
  data: string;
}

interface RunResult {
  return_code: number;
  logs: LogEntry[];
  messages: SentMessage[];
  ws_events: WSEvent[];
  build_error?: string;
  run_error?: string;
}

export function AppPlayground() {
  const [sourceCode, setSourceCode] = useState(DEFAULT_SOURCE);
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [eventType, setEventType] = useState(PRESET_EVENTS[0].event);
  const [payload, setPayload] = useState(PRESET_EVENTS[0].payload);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);
  const consoleRef = useRef<HTMLDivElement>(null);

  const addConsoleLog = useCallback((msg: string, type: 'info' | 'error' | 'success' | 'system' = 'info') => {
    const prefix = {
      info: '📋',
      error: '❌',
      success: '✅',
      system: '⚙️',
    }[type];
    setConsoleOutput(prev => [...prev, `${prefix} ${msg}`]);
  }, []);

  const handlePresetChange = (index: number) => {
    setSelectedPreset(index);
    setEventType(PRESET_EVENTS[index].event);
    setPayload(PRESET_EVENTS[index].payload);
  };

  const handleRun = async () => {
    setRunning(true);
    setResult(null);
    setConsoleOutput([]);
    addConsoleLog('Building & running plugin...', 'system');

    try {
      const token = localStorage.getItem('saybridge_access_token');
      const resp = await fetch('http://localhost:8080/api/v1/admin/playground/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          source_code: sourceCode,
          event: eventType,
          payload: payload,
        }),
      });

      // Read raw text first to avoid JSON parse errors on non-JSON responses
      const rawText = await resp.text();

      if (!resp.ok) {
        addConsoleLog(`Server error (${resp.status}): ${rawText.substring(0, 500)}`, 'error');
        return;
      }

      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch {
        addConsoleLog(`Invalid server response: ${rawText.substring(0, 500)}`, 'error');
        return;
      }

      const res: RunResult = data.data;
      if (!res) {
        addConsoleLog(`Unexpected response format: ${rawText.substring(0, 300)}`, 'error');
        return;
      }
      setResult(res);

      if (res.build_error) {
        addConsoleLog(`Build failed:\n${res.build_error}`, 'error');
      } else if (res.run_error) {
        addConsoleLog(`Runtime error: ${res.run_error}`, 'error');
      } else {
        addConsoleLog(`Build successful`, 'success');
        addConsoleLog(`Event: ${eventType}`, 'system');

        res.logs?.forEach(l => {
          addConsoleLog(`[${l.level.toUpperCase()}] ${l.message}`, l.level === 'error' ? 'error' : 'info');
        });

        res.messages?.forEach(m => {
          addConsoleLog(`[MSG → ${m.room_id}] ${m.content}`, 'success');
        });

        res.ws_events?.forEach(e => {
          addConsoleLog(`[WS → ${e.room_id}] ${e.event}: ${e.data}`, 'info');
        });

        addConsoleLog(`Return code: ${res.return_code}`, 'system');
        addConsoleLog(`Summary: ${res.logs?.length || 0} logs, ${res.messages?.length || 0} messages, ${res.ws_events?.length || 0} WS events`, 'system');
      }
    } catch (err: any) {
      addConsoleLog(`Network error: ${err.message}`, 'error');
    } finally {
      setRunning(false);
      // Auto-scroll console
      setTimeout(() => {
        if (consoleRef.current) {
          consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
        }
      }, 50);
    }
  };

  return (
    <div className="playground">
      <div style={{ padding: '24px 24px 0 24px' }}>
        <PageHeader
          title="App Playground"
          subtitle="Build, test, and debug WASM plugins in real-time"
          icon={<span className="playground-icon" style={{ fontSize: 18, lineHeight: 1 }}>🧪</span>}
          actions={
            <button
              className={`sb-btn sb-btn-primary ${running ? 'running' : ''}`}
              onClick={handleRun}
              disabled={running}
            >
              {running ? '⏳ Building...' : '▶ Build & Run'}
            </button>
          }
        />
      </div>

      <div className="playground-body">
        {/* Editor Panel */}
        <div className="playground-editor-panel">
          <div className="panel-header">
            <span>📝 main.go</span>
            <span className="panel-badge">TinyGo / WASI</span>
          </div>
          <div style={{ flex: 1, height: '100%', minHeight: '400px' }}>
            <Editor
              height="100%"
              language="go"
              theme="vs-dark"
              value={sourceCode}
              onChange={(val) => setSourceCode(val || '')}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                fontFamily: "'Fira Code', 'Courier New', Courier, monospace",
                automaticLayout: true,
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
                tabSize: 4,
              }}
            />
          </div>
        </div>

        {/* Right Panel: Events + Console */}
        <div className="playground-right">
          {/* Event Simulator */}
          <div className="playground-events-panel">
            <div className="panel-header">
              <span>🎯 Event Simulator</span>
            </div>
            <div className="events-content">
              <div className="event-presets">
                {PRESET_EVENTS.map((preset, i) => (
                  <button
                    key={i}
                    className={`event-preset-btn ${selectedPreset === i ? 'active' : ''}`}
                    onClick={() => handlePresetChange(i)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="event-fields">
                <label>Event Type</label>
                <input
                  type="text"
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className="event-input"
                />
                <label>Payload (JSON)</label>
                <textarea
                  value={payload}
                  onChange={(e) => setPayload(e.target.value)}
                  className="event-payload"
                  spellCheck={false}
                  rows={4}
                />
              </div>
            </div>
          </div>

          {/* Console */}
          <div className="playground-console-panel">
            <div className="panel-header">
              <span>🖥 Console</span>
              <button className="sb-btn sb-btn-ghost console-clear-btn" onClick={() => setConsoleOutput([])}>Clear</button>
            </div>
            <div className="console-output" ref={consoleRef}>
              {consoleOutput.length === 0 ? (
                <div className="console-empty">Click "Build & Run" to see output here</div>
              ) : (
                consoleOutput.map((line, i) => (
                  <div key={i} className={`console-line ${line.startsWith('❌') ? 'error' : line.startsWith('✅') ? 'success' : ''}`}>
                    {line}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
