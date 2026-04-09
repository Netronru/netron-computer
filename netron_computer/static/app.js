var viewport = document.querySelector("#viewport");
var screenImage = document.querySelector("#screenImage");
var screenOverlay = document.querySelector("#screenOverlay");
var keyboardBridge = document.querySelector("#keyboardBridge");
var audioPlayer = document.querySelector("#audioPlayer");
var soundButton = document.querySelector("#soundButton");
var keyboardButton = document.querySelector("#keyboardButton");
var leftControls = document.querySelector("#leftControls");
var monitorButton = document.querySelector("#monitorButton");
var cursorDot = document.querySelector("#cursorDot");
var BRIDGE_SENTINEL = "\u200b";

var state = {
  ws: null,
  screenWidth: 16,
  screenHeight: 9,
  lastObjectUrl: null,
  cursorRatioX: 0.5,
  cursorRatioY: 0.5,
  cursorClientX: null,
  cursorClientY: null,
  cursorHideTimer: null,
  fullscreenRequested: false,
  touchGesture: null,
  pointerStartX: 0,
  pointerStartY: 0,
  pointerStartAt: 0,
  bridgeValue: "",
  suppressNextInput: false,
  soundEnabled: false,
  audioSocket: null,
  audioContext: null,
  audioGain: null,
  audioSampleRate: 48000,
  audioChannels: 2,
  audioNextTime: 0,
  audioMode: "off",
  audioFallbackTimer: null,
  monitorIndex: 1,
  monitorCount: 1,
};

function websocketUrl() {
  var protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return protocol + "://" + window.location.host + "/ws";
}

function isConnected() {
  return state.ws && state.ws.readyState === WebSocket.OPEN;
}

function showOverlay(text) {
  screenOverlay.textContent = text;
  screenOverlay.classList.remove("hidden");
}

function hideOverlay() {
  screenOverlay.classList.add("hidden");
}

function connect() {
  if (state.ws && (state.ws.readyState === WebSocket.OPEN || state.ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  var ws = new WebSocket(websocketUrl());
  ws.binaryType = "blob";
  state.ws = ws;
  showOverlay("Connecting to the remote screen...");

  ws.addEventListener("message", function(event) {
    if (typeof event.data === "string") {
      handleServerMessage(event.data);
      return;
    }

    var previousUrl = state.lastObjectUrl;
    var objectUrl = URL.createObjectURL(event.data);
    screenImage.src = objectUrl;
    state.lastObjectUrl = objectUrl;
    hideOverlay();

    screenImage.onload = function() {
      if (previousUrl) {
        URL.revokeObjectURL(previousUrl);
      }
    };
  });

  ws.addEventListener("close", function() {
    if (state.lastObjectUrl) {
      URL.revokeObjectURL(state.lastObjectUrl);
      state.lastObjectUrl = null;
    }

    state.ws = null;
    showOverlay("Connection lost. Reload the page.");
  });

  ws.addEventListener("error", function() {
    showOverlay("Connection error.");
  });
}

function handleServerMessage(raw) {
  var message = JSON.parse(raw);

  if (message.type === "screen_info") {
    state.screenWidth = message.width;
    state.screenHeight = message.height;
    state.monitorIndex = message.monitor_index || 1;
    state.monitorCount = message.monitor_count || 1;

    if (typeof message.cursor_x === "number") {
      state.cursorRatioX = message.cursor_x;
    }
    if (typeof message.cursor_y === "number") {
      state.cursorRatioY = message.cursor_y;
    }

    syncCursorFromRatios();
    updateMonitorButton();
    return;
  }

  if (message.type === "cursor_update") {
    if (typeof message.cursor_x === "number") {
      state.cursorRatioX = clamp(message.cursor_x, 0, 1);
    }
    if (typeof message.cursor_y === "number") {
      state.cursorRatioY = clamp(message.cursor_y, 0, 1);
    }

    syncCursorFromRatios();
    return;
  }

  if (message.type === "error") {
    showOverlay(message.message);
  }
}

function updateMonitorButton() {
  var label;

  if (!leftControls || !monitorButton) {
    return;
  }

  if (state.monitorCount > 1) {
    leftControls.classList.remove("hidden");
    label = "Display";
    if (state.monitorIndex > 0) {
      label += " " + state.monitorIndex + "/" + state.monitorCount;
    }
    monitorButton.textContent = label;
    return;
  }

  leftControls.classList.add("hidden");
}

function send(payload) {
  if (!isConnected()) {
    return;
  }

  state.ws.send(JSON.stringify(payload));
}

function setSoundButtonState(enabled) {
  if (!soundButton) {
    return;
  }

  if (enabled) {
    soundButton.classList.add("active");
  } else {
    soundButton.classList.remove("active");
  }
}

function clearAudioFallbackTimer() {
  if (state.audioFallbackTimer) {
    window.clearTimeout(state.audioFallbackTimer);
    state.audioFallbackTimer = null;
  }
}

function createAudioEngine() {
  var AudioContextClass;
  var context;

  if (state.audioContext) {
    return;
  }

  AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error("AudioContext is not supported");
  }

  try {
    context = new AudioContextClass({
      latencyHint: "interactive",
      sampleRate: state.audioSampleRate,
    });
  } catch (error) {
    context = new AudioContextClass();
  }

  state.audioContext = context;
  state.audioGain = state.audioContext.createGain();
  state.audioGain.gain.value = 1;
  state.audioGain.connect(state.audioContext.destination);
  state.audioNextTime = 0;
}

function decodePcm16Chunk(buffer) {
  var pcm = new Int16Array(buffer);
  var floats = new Float32Array(pcm.length);
  var i;

  for (i = 0; i < pcm.length; i += 1) {
    floats[i] = pcm[i] / 32768;
  }

  return floats;
}

function scheduleAudioChunk(floatChunk) {
  var ctx;
  var frames;
  var buffer;
  var left;
  var right;
  var frameIndex;
  var sampleIndex;
  var source;
  var now;
  var startTime;

  if (!floatChunk || !floatChunk.length || !state.audioContext) {
    return;
  }

  ctx = state.audioContext;
  frames = Math.floor(floatChunk.length / state.audioChannels);
  if (!frames) {
    return;
  }

  buffer = ctx.createBuffer(state.audioChannels, frames, state.audioSampleRate);
  left = buffer.getChannelData(0);
  right = buffer.getChannelData(1);
  sampleIndex = 0;

  for (frameIndex = 0; frameIndex < frames; frameIndex += 1) {
    left[frameIndex] = floatChunk[sampleIndex] || 0;
    right[frameIndex] = floatChunk[sampleIndex + 1] || 0;
    sampleIndex += state.audioChannels;
  }

  now = ctx.currentTime;
  if (!state.audioNextTime || state.audioNextTime < now + 0.03) {
    state.audioNextTime = now + 0.03;
  }
  if (state.audioNextTime > now + 0.25) {
    state.audioNextTime = now + 0.05;
  }

  startTime = state.audioNextTime;
  source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(state.audioGain);
  source.start(startTime);
  state.audioNextTime = startTime + buffer.duration;
}

function ensureAudioRunning() {
  if (!state.audioContext) {
    createAudioEngine();
  }

  if (state.audioContext.state === "suspended") {
    return state.audioContext.resume();
  }

  return Promise.resolve();
}

function isFullscreenActive() {
  return !!(
    document.fullscreenElement
    || document.webkitFullscreenElement
    || document.webkitCurrentFullScreenElement
    || document.msFullscreenElement
  );
}

function requestFullscreenOnce() {
  var element = document.documentElement;
  var request = element.requestFullscreen
    || element.webkitRequestFullscreen
    || element.webkitRequestFullScreen
    || element.msRequestFullscreen;

  if (state.fullscreenRequested || !request) {
    return;
  }

  state.fullscreenRequested = true;

  try {
    var result = request.call(element);
    if (result && typeof result.then === "function") {
      result.catch(function() {
        state.fullscreenRequested = false;
      });
    }
  } catch (error) {
    state.fullscreenRequested = false;
  }
}

function focusKeyboardBridge() {
  if (!keyboardBridge) {
    return;
  }

  if (!keyboardBridge.value) {
    keyboardBridge.value = BRIDGE_SENTINEL;
  }

  keyboardBridge.focus();
  keyboardBridge.selectionStart = keyboardBridge.value.length;
  keyboardBridge.selectionEnd = keyboardBridge.value.length;
}

function resetKeyboardBridge() {
  if (!keyboardBridge) {
    return;
  }

  state.bridgeValue = BRIDGE_SENTINEL;
  state.suppressNextInput = true;
  keyboardBridge.value = BRIDGE_SENTINEL;
  keyboardBridge.selectionStart = keyboardBridge.value.length;
  keyboardBridge.selectionEnd = keyboardBridge.value.length;
}

function sendTextValue(text) {
  text = String(text || "").split(BRIDGE_SENTINEL).join("");
  if (!text) {
    return;
  }

  send({
    type: "type_text",
    text: text,
  });
}

function sendBackspace(count) {
  var i;
  for (i = 0; i < count; i += 1) {
    send({
      type: "key_tap",
      key: "backspace",
    });
  }
}

function handleBridgeBeforeInput(event) {
  if (!event) {
    return;
  }

  if (event.inputType === "insertText") {
    if (event.data) {
      sendTextValue(event.data);
      state.suppressNextInput = true;
      window.setTimeout(resetKeyboardBridge, 0);
    }
    return;
  }

  if (event.inputType === "insertLineBreak") {
    send({
      type: "key_tap",
      key: "enter",
    });
    state.suppressNextInput = true;
    window.setTimeout(resetKeyboardBridge, 0);
    return;
  }

  if (event.inputType === "deleteContentBackward") {
    sendBackspace(1);
    state.suppressNextInput = true;
    window.setTimeout(resetKeyboardBridge, 0);
  }
}

function handleBridgeInput() {
  var value;
  var appended;

  if (!keyboardBridge) {
    return;
  }

  if (state.suppressNextInput) {
    state.suppressNextInput = false;
    state.bridgeValue = keyboardBridge.value;
    return;
  }

  value = keyboardBridge.value;
  if (!value || value === BRIDGE_SENTINEL) {
    state.bridgeValue = value;
    return;
  }

  if (value.indexOf(state.bridgeValue) === 0) {
    appended = value.slice(state.bridgeValue.length);
    if (appended) {
      sendTextValue(appended);
    }
  } else if (state.bridgeValue.indexOf(value) === 0) {
    sendBackspace(state.bridgeValue.length - value.length);
  } else {
    sendTextValue(value);
  }

  resetKeyboardBridge();
}

function handleBridgeKeydown(event) {
  if (!event) {
    return;
  }

  if (event.key === "Enter") {
    send({
      type: "key_tap",
      key: "enter",
    });
    event.preventDefault();
    resetKeyboardBridge();
    return;
  }

  if (event.key === "Backspace") {
    send({
      type: "key_tap",
      key: "backspace",
    });
    event.preventDefault();
    resetKeyboardBridge();
    return;
  }

  if (event.key === "Tab") {
    send({
      type: "key_tap",
      key: "tab",
    });
    event.preventDefault();
    resetKeyboardBridge();
    return;
  }

  if (event.key === "Escape") {
    send({
      type: "key_tap",
      key: "escape",
    });
    event.preventDefault();
    resetKeyboardBridge();
    return;
  }
}

function handleBridgeCompositionEnd(event) {
  if (event && event.data) {
    sendTextValue(event.data);
    resetKeyboardBridge();
  }
}

function openKeyboardBridge(event) {
  requestFullscreenOnce();
  focusKeyboardBridge();

  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
}

function cycleMonitor(event) {
  requestFullscreenOnce();
  send({
    type: "cycle_monitor",
  });

  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
}

function stopAudioStream() {
  clearAudioFallbackTimer();

  if (state.audioSocket) {
    try {
      state.audioSocket.close();
    } catch (error) {
      // Ignore close errors from already-closed sockets.
    }
    state.audioSocket = null;
  }

  if (audioPlayer) {
    audioPlayer.pause();
    audioPlayer.removeAttribute("src");
    audioPlayer.load();
  }

  if (state.audioContext && state.audioContext.state === "running") {
    state.audioContext.suspend();
  }

  state.audioNextTime = 0;
  state.audioMode = "off";
  state.soundEnabled = false;
  setSoundButtonState(false);
}

function startFallbackAudioStream() {
  var playPromise;

  if (!audioPlayer) {
    throw new Error("Fallback audio is not supported");
  }

  clearAudioFallbackTimer();
  state.audioMode = "fallback";
  audioPlayer.src = "/audio-stream?ts=" + Date.now();
  audioPlayer.load();
  audioPlayer.volume = 1;
  audioPlayer.muted = false;
  audioPlayer.playsInline = true;
  playPromise = audioPlayer.play();

  if (playPromise && typeof playPromise.then === "function") {
    return playPromise.then(function() {
      state.soundEnabled = true;
      setSoundButtonState(true);
    });
  }

  state.soundEnabled = true;
  setSoundButtonState(true);
  return Promise.resolve();
}

function startAudioStream() {
  requestFullscreenOnce();
  ensureAudioRunning().then(function() {
    var protocol = window.location.protocol === "https:" ? "wss" : "ws";
    var ws;

    clearAudioFallbackTimer();
    state.audioNextTime = 0;
    state.audioMode = "web_audio";
    ws = new WebSocket(protocol + "://" + window.location.host + "/ws-audio");
    ws.binaryType = "arraybuffer";
    state.audioSocket = ws;

    state.audioFallbackTimer = window.setTimeout(function() {
      if (state.audioMode === "web_audio" && state.audioSocket === ws) {
        try {
          ws.close();
        } catch (error) {
          // Ignore close errors during fallback.
        }
        startFallbackAudioStream().catch(function() {
          stopAudioStream();
          showOverlay("Could not enable sound.");
          window.setTimeout(hideOverlay, 1600);
        });
      }
    }, 1500);

    ws.addEventListener("open", function() {
      state.soundEnabled = true;
      setSoundButtonState(true);
    });

    ws.addEventListener("message", function(event) {
      var message;

      if (typeof event.data === "string") {
        message = JSON.parse(event.data);
        if (message.type === "audio_config") {
          state.audioSampleRate = message.sample_rate || state.audioSampleRate;
          state.audioChannels = message.channels || state.audioChannels;
        }
        return;
      }

      clearAudioFallbackTimer();
      scheduleAudioChunk(decodePcm16Chunk(event.data));
    });

    ws.addEventListener("close", function() {
      if (state.audioSocket === ws) {
        state.audioSocket = null;
        if (state.audioMode === "web_audio") {
          state.soundEnabled = false;
          setSoundButtonState(false);
        }
      }
    });

    ws.addEventListener("error", function() {
      if (state.audioSocket === ws) {
        try {
          ws.close();
        } catch (error) {
          // Ignore close errors during fallback.
        }
      }
      startFallbackAudioStream().catch(function() {
        stopAudioStream();
        showOverlay("Could not enable sound.");
        window.setTimeout(hideOverlay, 1600);
      });
    });
  }).catch(function() {
    startFallbackAudioStream().catch(function() {
      stopAudioStream();
      showOverlay("Sound could not start.");
      window.setTimeout(hideOverlay, 1600);
    });
  });
}

function toggleAudioStream(event) {
  if (state.soundEnabled) {
    stopAudioStream();
  } else {
    startAudioStream();
  }

  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
}

function clamp(value, minValue, maxValue) {
  return Math.max(minValue, Math.min(maxValue, value));
}

function getDrawArea() {
  var rect = viewport.getBoundingClientRect();
  var screenAspect = state.screenWidth / state.screenHeight;
  var rectAspect = rect.width / rect.height;

  var drawWidth = rect.width;
  var drawHeight = rect.height;
  var offsetX = 0;
  var offsetY = 0;

  if (rectAspect > screenAspect) {
    drawHeight = rect.height;
    drawWidth = drawHeight * screenAspect;
    offsetX = (rect.width - drawWidth) / 2;
  } else {
    drawWidth = rect.width;
    drawHeight = drawWidth / screenAspect;
    offsetY = (rect.height - drawHeight) / 2;
  }

  return {
    left: rect.left + offsetX,
    top: rect.top + offsetY,
    width: drawWidth,
    height: drawHeight,
  };
}

function positionCursorDot() {
  if (state.cursorClientX === null || state.cursorClientY === null) {
    return;
  }

  cursorDot.style.left = state.cursorClientX + "px";
  cursorDot.style.top = state.cursorClientY + "px";
}

function syncCursorFromRatios() {
  var area = getDrawArea();
  state.cursorClientX = area.left + area.width * state.cursorRatioX;
  state.cursorClientY = area.top + area.height * state.cursorRatioY;
  positionCursorDot();
}

function showCursor() {
  if (state.cursorClientX === null || state.cursorClientY === null) {
    syncCursorFromRatios();
  }

  positionCursorDot();
  cursorDot.classList.remove("hidden");

  if (state.cursorHideTimer) {
    window.clearTimeout(state.cursorHideTimer);
  }

  state.cursorHideTimer = window.setTimeout(function() {
    cursorDot.classList.add("hidden");
    state.cursorHideTimer = null;
  }, 5000);
}

function moveLocalCursorBy(dxClient, dyClient) {
  var area = getDrawArea();

  if (state.cursorClientX === null || state.cursorClientY === null) {
    syncCursorFromRatios();
  }

  state.cursorClientX = clamp(state.cursorClientX + dxClient, area.left, area.left + area.width);
  state.cursorClientY = clamp(state.cursorClientY + dyClient, area.top, area.top + area.height);
  state.cursorRatioX = (state.cursorClientX - area.left) / Math.max(1, area.width);
  state.cursorRatioY = (state.cursorClientY - area.top) / Math.max(1, area.height);

  showCursor();
}

function setLocalCursorToPoint(clientX, clientY) {
  var area = getDrawArea();
  state.cursorClientX = clamp(clientX, area.left, area.left + area.width);
  state.cursorClientY = clamp(clientY, area.top, area.top + area.height);
  state.cursorRatioX = (state.cursorClientX - area.left) / Math.max(1, area.width);
  state.cursorRatioY = (state.cursorClientY - area.top) / Math.max(1, area.height);
  showCursor();
}

function getNormalizedPoint(clientX, clientY) {
  var area = getDrawArea();
  var x = clientX - area.left;
  var y = clientY - area.top;

  if (x < 0 || y < 0 || x > area.width || y > area.height) {
    return null;
  }

  return {
    x: x / area.width,
    y: y / area.height,
  };
}

function sendRelativeMove(dxClient, dyClient) {
  var area = getDrawArea();
  var dxScreen = dxClient * state.screenWidth / Math.max(1, area.width);
  var dyScreen = dyClient * state.screenHeight / Math.max(1, area.height);

  if (!dxScreen && !dyScreen) {
    return;
  }

  moveLocalCursorBy(dxClient, dyClient);
  send({
    type: "move_relative",
    dx: dxScreen,
    dy: dyScreen,
  });
}

function pointerDistance(x1, y1, x2, y2) {
  var dx = x2 - x1;
  var dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

function getTouchCentroid(touchA, touchB) {
  return {
    x: (touchA.clientX + touchB.clientX) / 2,
    y: (touchA.clientY + touchB.clientY) / 2,
  };
}

function startSingleFingerGesture(touch) {
  state.touchGesture = {
    type: "single_finger",
    startX: touch.clientX,
    startY: touch.clientY,
    prevX: touch.clientX,
    prevY: touch.clientY,
    startAt: Date.now(),
    moved: false,
  };
}

function startTwoFingerGesture(touchA, touchB) {
  var centroid = getTouchCentroid(touchA, touchB);

  state.touchGesture = {
    type: "two_finger",
    startX: centroid.x,
    startY: centroid.y,
    prevX: centroid.x,
    prevY: centroid.y,
    startAt: Date.now(),
    moved: false,
    scrollAccumulatorY: 0,
  };
}

function handleTwoFingerScroll(deltaY) {
  var gesture = state.touchGesture;
  var threshold = 20;

  gesture.scrollAccumulatorY += -deltaY;

  while (gesture.scrollAccumulatorY >= threshold) {
    send({
      type: "scroll",
      delta_y: 120,
    });
    gesture.scrollAccumulatorY -= threshold;
  }

  while (gesture.scrollAccumulatorY <= -threshold) {
    send({
      type: "scroll",
      delta_y: -120,
    });
    gesture.scrollAccumulatorY += threshold;
  }
}

function onTouchStart(event) {
  requestFullscreenOnce();

  if (!event.touches || !event.touches.length) {
    return;
  }

  if (event.touches.length >= 2) {
    startTwoFingerGesture(event.touches[0], event.touches[1]);
  } else {
    startSingleFingerGesture(event.touches[0]);
  }

  showCursor();
  event.preventDefault();
}

function onTouchMove(event) {
  var gesture = state.touchGesture;

  if (!gesture || !event.touches || !event.touches.length) {
    return;
  }

  if (event.touches.length >= 2) {
    if (gesture.type !== "two_finger") {
      startTwoFingerGesture(event.touches[0], event.touches[1]);
      gesture = state.touchGesture;
    }

    var centroid = getTouchCentroid(event.touches[0], event.touches[1]);
    var dx = centroid.x - gesture.prevX;
    var dy = centroid.y - gesture.prevY;

    if (pointerDistance(centroid.x, centroid.y, gesture.startX, gesture.startY) > 12) {
      gesture.moved = true;
    }

    handleTwoFingerScroll(dy);
    gesture.prevX = centroid.x;
    gesture.prevY = centroid.y;
    showCursor();
    event.preventDefault();
    return;
  }

  if (gesture.type !== "single_finger") {
    startSingleFingerGesture(event.touches[0]);
    gesture = state.touchGesture;
  }

  var touch = event.touches[0];
  var moveX = touch.clientX - gesture.prevX;
  var moveY = touch.clientY - gesture.prevY;

  if (pointerDistance(touch.clientX, touch.clientY, gesture.startX, gesture.startY) > 10) {
    gesture.moved = true;
  }

  sendRelativeMove(moveX, moveY);
  gesture.prevX = touch.clientX;
  gesture.prevY = touch.clientY;
  event.preventDefault();
}

function onTouchEnd(event) {
  var gesture = state.touchGesture;

  if (!gesture) {
    return;
  }

  if (gesture.type === "two_finger") {
    if (!event.touches.length) {
      if (!gesture.moved && Date.now() - gesture.startAt < 280) {
        showCursor();
        send({
          type: "button_click",
          button: "right",
        });
      }

      state.touchGesture = null;
      event.preventDefault();
      return;
    }

    if (event.touches.length === 1) {
      startSingleFingerGesture(event.touches[0]);
      event.preventDefault();
      return;
    }

    startTwoFingerGesture(event.touches[0], event.touches[1]);
    event.preventDefault();
    return;
  }

  if (!event.touches.length) {
    if (!gesture.moved && Date.now() - gesture.startAt < 260) {
      showCursor();
      send({
        type: "button_click",
        button: "left",
      });
    }

    state.touchGesture = null;
    event.preventDefault();
    return;
  }

  if (event.touches.length >= 2) {
    startTwoFingerGesture(event.touches[0], event.touches[1]);
  } else {
    startSingleFingerGesture(event.touches[0]);
  }

  event.preventDefault();
}

function onTouchCancel(event) {
  state.touchGesture = null;
  event.preventDefault();
}

function onPointerDown(event) {
  var point = getNormalizedPoint(event.clientX, event.clientY);
  if (!point) {
    return;
  }

  requestFullscreenOnce();
  state.pointerStartX = event.clientX;
  state.pointerStartY = event.clientY;
  state.pointerStartAt = Date.now();
  setLocalCursorToPoint(event.clientX, event.clientY);
  if (viewport.setPointerCapture && event.pointerId !== undefined) {
    viewport.setPointerCapture(event.pointerId);
  }
  send({
    type: "move",
    x: point.x,
    y: point.y,
  });
  event.preventDefault();
}

function onPointerMove(event) {
  var point = getNormalizedPoint(event.clientX, event.clientY);
  if (!point) {
    return;
  }

  setLocalCursorToPoint(event.clientX, event.clientY);
  send({
    type: "move",
    x: point.x,
    y: point.y,
  });
  event.preventDefault();
}

function onPointerUp(event) {
  if (viewport.hasPointerCapture && event.pointerId !== undefined && viewport.hasPointerCapture(event.pointerId)) {
    viewport.releasePointerCapture(event.pointerId);
  }

  if (pointerDistance(event.clientX, event.clientY, state.pointerStartX, state.pointerStartY) < 14
    && Date.now() - state.pointerStartAt < 260) {
    send({
      type: "button_click",
      button: "left",
    });
  }

  event.preventDefault();
}

function onPointerCancel(event) {
  if (viewport.hasPointerCapture && event.pointerId !== undefined && viewport.hasPointerCapture(event.pointerId)) {
    viewport.releasePointerCapture(event.pointerId);
  }
}

window.addEventListener("resize", function() {
  syncCursorFromRatios();
}, false);

document.addEventListener("fullscreenchange", function() {
  state.fullscreenRequested = isFullscreenActive();
}, false);

document.addEventListener("webkitfullscreenchange", function() {
  state.fullscreenRequested = isFullscreenActive();
}, false);

window.addEventListener("load", function() {
  requestFullscreenOnce();
}, false);

document.addEventListener("touchstart", requestFullscreenOnce, true);
document.addEventListener("pointerdown", requestFullscreenOnce, true);
document.addEventListener("mousedown", requestFullscreenOnce, true);

if (keyboardBridge) {
  keyboardBridge.addEventListener("beforeinput", handleBridgeBeforeInput, false);
  keyboardBridge.addEventListener("input", handleBridgeInput, false);
  keyboardBridge.addEventListener("keydown", handleBridgeKeydown, false);
  keyboardBridge.addEventListener("compositionend", handleBridgeCompositionEnd, false);
  resetKeyboardBridge();
}

if (keyboardButton) {
  keyboardButton.addEventListener("click", openKeyboardBridge, false);
}

if (soundButton) {
  soundButton.addEventListener("click", toggleAudioStream, false);
  setSoundButtonState(false);
}

if (monitorButton) {
  monitorButton.addEventListener("click", cycleMonitor, false);
}

if ("ontouchstart" in window) {
  viewport.addEventListener("touchstart", onTouchStart, false);
  viewport.addEventListener("touchmove", onTouchMove, false);
  viewport.addEventListener("touchend", onTouchEnd, false);
  viewport.addEventListener("touchcancel", onTouchCancel, false);
} else if (window.PointerEvent) {
  viewport.addEventListener("pointerdown", onPointerDown, false);
  viewport.addEventListener("pointermove", onPointerMove, false);
  viewport.addEventListener("pointerup", onPointerUp, false);
  viewport.addEventListener("pointercancel", onPointerCancel, false);
} else {
  viewport.addEventListener("mousedown", onPointerDown, false);
  viewport.addEventListener("mousemove", onPointerMove, false);
  viewport.addEventListener("mouseup", onPointerUp, false);
}

viewport.addEventListener("contextmenu", function(event) {
  event.preventDefault();
}, false);

connect();
