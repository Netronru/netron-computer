var connectScreen = document.querySelector("#connectScreen");
var connectButton = document.querySelector("#connectButton");
var connectStatus = document.querySelector("#connectStatus");
var connectCopy = document.querySelector("#connectCopy");
var settingsLauncher = document.querySelector("#settingsLauncher");
var viewerSettingsButton = document.querySelector("#viewerSettingsButton");
var loginSheet = document.querySelector("#loginSheet");
var loginForm = document.querySelector("#loginForm");
var loginStatus = document.querySelector("#loginStatus");
var loginUsername = document.querySelector("#loginUsername");
var loginPassword = document.querySelector("#loginPassword");
var cancelLoginButton = document.querySelector("#cancelLoginButton");
var viewerScreen = document.querySelector("#viewerScreen");
var mobileViewport = document.querySelector("#mobileViewport");
var mobileScreenImage = document.querySelector("#mobileScreenImage");
var mobileOverlay = document.querySelector("#mobileOverlay");
var mobileCursorDot = document.querySelector("#mobileCursorDot");
var mobileKeyboardBridge = document.querySelector("#mobileKeyboardBridge");
var mobileAudioPlayer = document.querySelector("#mobileAudioPlayer");
var soundIconButton = document.querySelector("#soundIconButton");
var keyboardIconButton = document.querySelector("#keyboardIconButton");
var displayButton = document.querySelector("#displayButton");
var displayDock = document.querySelector("#displayDock");
var settingsSheet = document.querySelector("#settingsSheet");
var closeSettingsButton = document.querySelector("#closeSettingsButton");
var languageSelect = document.querySelector("#languageSelect");
var autoSearchToggle = document.querySelector("#autoSearchToggle");
var hostInput = document.querySelector("#hostInput");
var portInput = document.querySelector("#portInput");
var autoSearchLabel = document.querySelector("#autoSearchLabel");
var settingsTitle = document.querySelector("#settingsTitle");
var loginTitle = document.querySelector("#loginTitle");
var submitLoginButton = document.querySelector("#submitLoginButton");
var BRIDGE_SENTINEL = "\u200b";
var STORAGE_KEY = "netron_computer_mobile_settings";

var STRINGS = {
  en: {
    connect_copy: "Tap connect to find your computer on the local network.",
    connect: "Connect",
    connecting: "Searching for your computer...",
    connect_failed: "Could not find an NTRN server. Check Wi-Fi and port settings.",
    login_title: "Sign in",
    username: "Username",
    password: "Password",
    open: "Open",
    back: "Back",
    login_failed: "Invalid username or password.",
    login_in_progress: "Signing in...",
    overlay_connecting: "Connecting to the remote screen...",
    overlay_lost: "Connection lost. Reconnect from the main screen.",
    overlay_error: "Connection error.",
    overlay_audio_failed: "Could not enable sound.",
    overlay_audio_start_failed: "Sound could not start.",
    settings: "Settings",
    auto_search: "Auto-search nearby ports",
    host: "Computer host",
    port: "Starting port",
    sound: "Sound",
    keyboard: "Keyboard",
    display: "Display",
    rotate: "Rotate your phone to landscape for the best experience.",
  },
  ru: {
    connect_copy: "Нажмите подключиться, чтобы найти компьютер в локальной сети.",
    connect: "Подключиться",
    connecting: "Ищем ваш компьютер...",
    connect_failed: "Не удалось найти сервер NTRN. Проверьте Wi-Fi и настройки порта.",
    login_title: "Вход",
    username: "Логин",
    password: "Пароль",
    open: "Открыть",
    back: "Назад",
    login_failed: "Неверный логин или пароль.",
    login_in_progress: "Выполняется вход...",
    overlay_connecting: "Подключение к удаленному экрану...",
    overlay_lost: "Соединение потеряно. Подключитесь заново с главного экрана.",
    overlay_error: "Ошибка подключения.",
    overlay_audio_failed: "Не удалось включить звук.",
    overlay_audio_start_failed: "Звук не запустился.",
    settings: "Настройки",
    auto_search: "Автопоиск соседних портов",
    host: "Адрес компьютера",
    port: "Начальный порт",
    sound: "Звук",
    keyboard: "Клавиатура",
    display: "Монитор",
    rotate: "Поверните телефон горизонтально для лучшего режима.",
  },
  es: {
    connect_copy: "Pulsa conectar para encontrar tu computadora en la red local.",
    connect: "Conectar",
    connecting: "Buscando tu computadora...",
    connect_failed: "No se pudo encontrar un servidor NTRN. Revisa el Wi-Fi y el puerto.",
    login_title: "Iniciar sesión",
    username: "Usuario",
    password: "Contraseña",
    open: "Abrir",
    back: "Atrás",
    login_failed: "Usuario o contraseña incorrectos.",
    login_in_progress: "Iniciando sesión...",
    overlay_connecting: "Conectando con la pantalla remota...",
    overlay_lost: "Se perdió la conexión. Vuelve a conectar desde la pantalla principal.",
    overlay_error: "Error de conexión.",
    overlay_audio_failed: "No se pudo activar el sonido.",
    overlay_audio_start_failed: "No se pudo iniciar el sonido.",
    settings: "Ajustes",
    auto_search: "Buscar puertos cercanos automáticamente",
    host: "Host del equipo",
    port: "Puerto inicial",
    sound: "Sonido",
    keyboard: "Teclado",
    display: "Pantalla",
    rotate: "Gira el teléfono a horizontal para una mejor experiencia.",
  },
};

var state = {
  settings: null,
  ws: null,
  token: "",
  serverBaseUrl: "",
  screenWidth: 16,
  screenHeight: 9,
  lastObjectUrl: null,
  cursorRatioX: 0.5,
  cursorRatioY: 0.5,
  cursorClientX: null,
  cursorClientY: null,
  cursorHideTimer: null,
  touchGesture: null,
  pointerStartX: 0,
  pointerStartY: 0,
  pointerStartAt: 0,
  bridgeValue: "",
  suppressNextInput: false,
  monitorIndex: 1,
  monitorCount: 1,
  audioEnabled: true,
  soundEnabled: false,
  audioSocket: null,
  audioContext: null,
  audioGain: null,
  audioSampleRate: 48000,
  audioChannels: 2,
  audioNextTime: 0,
  audioMode: "off",
  audioFallbackTimer: null,
};

function currentLanguage() {
  return state.settings.language || "en";
}

function tr(key) {
  var lang = currentLanguage();
  if (!STRINGS[lang]) {
    lang = "en";
  }
  return STRINGS[lang][key] || STRINGS.en[key] || key;
}

function loadSettings() {
  var raw;
  var parsed;
  var host = window.location.hostname || "127.0.0.1";
  var port = window.location.port || "3001";

  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
    parsed = raw ? JSON.parse(raw) : {};
  } catch (error) {
    parsed = {};
  }

  state.settings = {
    language: parsed.language || document.documentElement.lang || "en",
    autoSearch: parsed.autoSearch !== false,
    host: parsed.host || host,
    port: String(parsed.port || port),
  };
}

function saveSettings() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
}

function applyTranslations() {
  document.documentElement.lang = currentLanguage();
  connectCopy.textContent = tr("connect_copy");
  connectButton.textContent = tr("connect");
  loginTitle.textContent = tr("login_title");
  document.querySelector("label[for='loginUsername']").textContent = tr("username");
  document.querySelector("label[for='loginPassword']").textContent = tr("password");
  submitLoginButton.textContent = tr("open");
  cancelLoginButton.textContent = tr("back");
  settingsTitle.textContent = tr("settings");
  autoSearchLabel.textContent = tr("auto_search");
  document.querySelector("label[for='hostInput']").textContent = tr("host");
  document.querySelector("label[for='portInput']").textContent = tr("port");
  soundIconButton.setAttribute("aria-label", tr("sound"));
  keyboardIconButton.setAttribute("aria-label", tr("keyboard"));
  displayButton.setAttribute("aria-label", tr("display"));
  settingsLauncher.setAttribute("aria-label", tr("settings"));
  viewerSettingsButton.setAttribute("aria-label", tr("settings"));
  if (!viewerScreen.classList.contains("hidden")) {
    mobileOverlay.textContent = tr("overlay_connecting");
  }
}

function openSettings() {
  languageSelect.value = state.settings.language;
  autoSearchToggle.checked = !!state.settings.autoSearch;
  hostInput.value = state.settings.host;
  portInput.value = state.settings.port;
  settingsSheet.classList.remove("hidden");
}

function closeSettings() {
  settingsSheet.classList.add("hidden");
}

function persistSettingsFromSheet() {
  state.settings.language = languageSelect.value || "en";
  state.settings.autoSearch = !!autoSearchToggle.checked;
  state.settings.host = (hostInput.value || window.location.hostname || "127.0.0.1").trim();
  state.settings.port = String(portInput.value || "3001").trim();
  saveSettings();
  applyTranslations();
}

function showConnectStatus(text) {
  connectStatus.textContent = text || "";
}

function showLoginStatus(text) {
  loginStatus.textContent = text || "";
}

function showOverlay(text) {
  mobileOverlay.textContent = text;
  mobileOverlay.classList.remove("hidden");
}

function hideOverlay() {
  mobileOverlay.classList.add("hidden");
}

function buildBaseUrl(host, port) {
  var protocol = window.location.protocol === "https:" ? "https://" : "http://";
  return protocol + host + ":" + port;
}

function buildWsUrl(baseUrl, path, token) {
  var protocol = baseUrl.indexOf("https://") === 0 ? "wss://" : "ws://";
  var withoutProtocol = baseUrl.replace(/^https?:\/\//, "");
  return protocol + withoutProtocol + path + "?token=" + encodeURIComponent(token);
}

function buildCandidateBaseUrls() {
  var host = state.settings.host || window.location.hostname || "127.0.0.1";
  var basePort = parseInt(state.settings.port, 10) || 3001;
  var ports = [basePort];
  var offsets = [1, -1, 2, -2, 10];
  var i;
  var candidate;

  if (state.settings.autoSearch) {
    for (i = 0; i < offsets.length; i += 1) {
      candidate = basePort + offsets[i];
      if (candidate >= 1 && candidate <= 65535 && ports.indexOf(candidate) === -1) {
        ports.push(candidate);
      }
    }
  }

  return ports.map(function(port) {
    return buildBaseUrl(host, port);
  });
}

function fetchJson(url, options) {
  return fetch(url, options).then(function(response) {
    if (!response.ok) {
      return response.json().catch(function() {
        return {};
      }).then(function(payload) {
        var error = new Error(payload.message || response.statusText || "Request failed");
        error.response = response;
        throw error;
      });
    }
    return response.json();
  });
}

function discoverServer() {
  var candidates = buildCandidateBaseUrls();
  var index = 0;

  function tryNext() {
    if (index >= candidates.length) {
      throw new Error(tr("connect_failed"));
    }

    var baseUrl = candidates[index];
    index += 1;

    return fetchJson(baseUrl + "/api/public-config", {
      cache: "no-store",
    }).then(function(config) {
      state.serverBaseUrl = baseUrl;
      state.audioEnabled = config.audio_enabled !== false;
      state.settings.language = state.settings.language || config.language || "en";
      state.settings.port = String((new URL(baseUrl)).port || state.settings.port || "3001");
      saveSettings();
      return config;
    }).catch(function() {
      return tryNext();
    });
  }

  return tryNext();
}

function showLoginSheet() {
  loginSheet.classList.remove("hidden");
  loginSheet.setAttribute("aria-hidden", "false");
  loginUsername.value = loginUsername.value || "admin";
  loginPassword.value = loginPassword.value || "admin";
  showLoginStatus("");
}

function hideLoginSheet() {
  loginSheet.classList.add("hidden");
  loginSheet.setAttribute("aria-hidden", "true");
}

function activateViewer() {
  connectScreen.classList.remove("active");
  viewerScreen.classList.remove("hidden");
  requestLandscapeMode();
}

function connectViewerSocket() {
  if (state.ws && (state.ws.readyState === WebSocket.OPEN || state.ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  var ws = new WebSocket(buildWsUrl(state.serverBaseUrl, "/ws", state.token));
  ws.binaryType = "blob";
  state.ws = ws;
  showOverlay(tr("overlay_connecting"));

  ws.addEventListener("message", function(event) {
    if (typeof event.data === "string") {
      handleServerMessage(event.data);
      return;
    }

    var previousUrl = state.lastObjectUrl;
    var objectUrl = URL.createObjectURL(event.data);
    mobileScreenImage.src = objectUrl;
    state.lastObjectUrl = objectUrl;
    hideOverlay();

    mobileScreenImage.onload = function() {
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
    showOverlay(tr("overlay_lost"));
  });

  ws.addEventListener("error", function() {
    showOverlay(tr("overlay_error"));
  });
}

function performLogin(event) {
  if (event) {
    event.preventDefault();
  }

  showLoginStatus(tr("login_in_progress"));
  fetchJson(state.serverBaseUrl + "/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: loginUsername.value,
      password: loginPassword.value,
    }),
  }).then(function(payload) {
    state.token = payload.token;
    state.audioEnabled = payload.audio_enabled !== false;
    hideLoginSheet();
    activateViewer();
    updateSoundVisibility();
    connectViewerSocket();
  }).catch(function() {
    showLoginStatus(tr("login_failed"));
  });
}

function startConnectFlow() {
  showConnectStatus(tr("connecting"));
  requestLandscapeMode();
  discoverServer().then(function() {
    showConnectStatus("");
    showLoginSheet();
  }).catch(function(error) {
    showConnectStatus(error.message || tr("connect_failed"));
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
    updateDisplayButton();
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

function send(payload) {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
    return;
  }
  state.ws.send(JSON.stringify(payload));
}

function updateDisplayButton() {
  if (state.monitorCount > 1) {
    displayDock.classList.remove("hidden");
  } else {
    displayDock.classList.add("hidden");
  }
}

function updateSoundVisibility() {
  if (state.audioEnabled) {
    soundIconButton.classList.remove("hidden");
  } else {
    soundIconButton.classList.add("hidden");
  }
}

function cycleDisplay(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  send({ type: "cycle_monitor" });
}

function clamp(value, minValue, maxValue) {
  return Math.max(minValue, Math.min(maxValue, value));
}

function getDrawArea() {
  var rect = mobileViewport.getBoundingClientRect();
  var screenAspect = state.screenWidth / state.screenHeight;
  var rectAspect = rect.width / rect.height;
  var drawWidth = rect.width;
  var drawHeight = rect.height;
  var offsetX = 0;
  var offsetY = 0;

  if (rectAspect > screenAspect) {
    drawWidth = rect.height * screenAspect;
    offsetX = (rect.width - drawWidth) / 2;
  } else {
    drawHeight = rect.width / screenAspect;
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
  mobileCursorDot.style.left = state.cursorClientX + "px";
  mobileCursorDot.style.top = state.cursorClientY + "px";
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
  mobileCursorDot.classList.remove("hidden");
  if (state.cursorHideTimer) {
    window.clearTimeout(state.cursorHideTimer);
  }
  state.cursorHideTimer = window.setTimeout(function() {
    mobileCursorDot.classList.add("hidden");
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
    send({ type: "scroll", delta_y: 120 });
    gesture.scrollAccumulatorY -= threshold;
  }
  while (gesture.scrollAccumulatorY <= -threshold) {
    send({ type: "scroll", delta_y: -120 });
    gesture.scrollAccumulatorY += threshold;
  }
}

function onTouchStart(event) {
  if (!event.touches || !event.touches.length) {
    return;
  }
  requestLandscapeMode();
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
  var centroid;
  var touch;
  var dx;
  var dy;
  var moveX;
  var moveY;

  if (!gesture || !event.touches || !event.touches.length) {
    return;
  }

  if (event.touches.length >= 2) {
    if (gesture.type !== "two_finger") {
      startTwoFingerGesture(event.touches[0], event.touches[1]);
      gesture = state.touchGesture;
    }
    centroid = getTouchCentroid(event.touches[0], event.touches[1]);
    dx = centroid.x - gesture.prevX;
    dy = centroid.y - gesture.prevY;
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

  touch = event.touches[0];
  moveX = touch.clientX - gesture.prevX;
  moveY = touch.clientY - gesture.prevY;

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
        send({ type: "button_click", button: "right" });
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
      send({ type: "button_click", button: "left" });
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
  state.pointerStartX = event.clientX;
  state.pointerStartY = event.clientY;
  state.pointerStartAt = Date.now();
  setLocalCursorToPoint(event.clientX, event.clientY);
  if (mobileViewport.setPointerCapture && event.pointerId !== undefined) {
    mobileViewport.setPointerCapture(event.pointerId);
  }
  send({ type: "move", x: point.x, y: point.y });
  event.preventDefault();
}

function onPointerMove(event) {
  var point = getNormalizedPoint(event.clientX, event.clientY);
  if (!point) {
    return;
  }
  setLocalCursorToPoint(event.clientX, event.clientY);
  send({ type: "move", x: point.x, y: point.y });
  event.preventDefault();
}

function onPointerUp(event) {
  if (mobileViewport.hasPointerCapture && event.pointerId !== undefined && mobileViewport.hasPointerCapture(event.pointerId)) {
    mobileViewport.releasePointerCapture(event.pointerId);
  }
  if (pointerDistance(event.clientX, event.clientY, state.pointerStartX, state.pointerStartY) < 14
    && Date.now() - state.pointerStartAt < 260) {
    send({ type: "button_click", button: "left" });
  }
  event.preventDefault();
}

function onPointerCancel(event) {
  if (mobileViewport.hasPointerCapture && event.pointerId !== undefined && mobileViewport.hasPointerCapture(event.pointerId)) {
    mobileViewport.releasePointerCapture(event.pointerId);
  }
}

function focusKeyboardBridge() {
  if (!mobileKeyboardBridge.value) {
    mobileKeyboardBridge.value = BRIDGE_SENTINEL;
  }
  mobileKeyboardBridge.focus();
  mobileKeyboardBridge.selectionStart = mobileKeyboardBridge.value.length;
  mobileKeyboardBridge.selectionEnd = mobileKeyboardBridge.value.length;
}

function resetKeyboardBridge() {
  state.bridgeValue = BRIDGE_SENTINEL;
  state.suppressNextInput = true;
  mobileKeyboardBridge.value = BRIDGE_SENTINEL;
  mobileKeyboardBridge.selectionStart = mobileKeyboardBridge.value.length;
  mobileKeyboardBridge.selectionEnd = mobileKeyboardBridge.value.length;
}

function sendTextValue(text) {
  text = String(text || "").split(BRIDGE_SENTINEL).join("");
  if (!text) {
    return;
  }
  send({ type: "type_text", text: text });
}

function sendBackspace(count) {
  var i;
  for (i = 0; i < count; i += 1) {
    send({ type: "key_tap", key: "backspace" });
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
    send({ type: "key_tap", key: "enter" });
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
  if (state.suppressNextInput) {
    state.suppressNextInput = false;
    state.bridgeValue = mobileKeyboardBridge.value;
    return;
  }

  value = mobileKeyboardBridge.value;
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
  if (event.key === "Enter") {
    send({ type: "key_tap", key: "enter" });
    event.preventDefault();
    resetKeyboardBridge();
    return;
  }
  if (event.key === "Backspace") {
    send({ type: "key_tap", key: "backspace" });
    event.preventDefault();
    resetKeyboardBridge();
    return;
  }
  if (event.key === "Tab") {
    send({ type: "key_tap", key: "tab" });
    event.preventDefault();
    resetKeyboardBridge();
    return;
  }
  if (event.key === "Escape") {
    send({ type: "key_tap", key: "escape" });
    event.preventDefault();
    resetKeyboardBridge();
  }
}

function handleBridgeCompositionEnd(event) {
  if (event && event.data) {
    sendTextValue(event.data);
    resetKeyboardBridge();
  }
}

function openKeyboardBridge(event) {
  focusKeyboardBridge();
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
}

function clearAudioFallbackTimer() {
  if (state.audioFallbackTimer) {
    window.clearTimeout(state.audioFallbackTimer);
    state.audioFallbackTimer = null;
  }
}

function setSoundButtonState(enabled) {
  if (enabled) {
    soundIconButton.classList.add("active");
  } else {
    soundIconButton.classList.remove("active");
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

function ensureAudioRunning() {
  if (!state.audioContext) {
    createAudioEngine();
  }
  if (state.audioContext.state === "suspended") {
    return state.audioContext.resume();
  }
  return Promise.resolve();
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

function stopAudioStream() {
  clearAudioFallbackTimer();

  if (state.audioSocket) {
    try {
      state.audioSocket.close();
    } catch (error) {
      // Ignore close errors.
    }
    state.audioSocket = null;
  }

  mobileAudioPlayer.pause();
  mobileAudioPlayer.removeAttribute("src");
  mobileAudioPlayer.load();

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
  clearAudioFallbackTimer();
  state.audioMode = "fallback";
  mobileAudioPlayer.src = state.serverBaseUrl + "/audio-stream?token=" + encodeURIComponent(state.token) + "&ts=" + Date.now();
  mobileAudioPlayer.load();
  mobileAudioPlayer.volume = 1;
  mobileAudioPlayer.muted = false;
  mobileAudioPlayer.playsInline = true;
  playPromise = mobileAudioPlayer.play();

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
  if (!state.audioEnabled) {
    return;
  }

  ensureAudioRunning().then(function() {
    var ws = new WebSocket(buildWsUrl(state.serverBaseUrl, "/ws-audio", state.token));
    ws.binaryType = "arraybuffer";
    state.audioSocket = ws;
    clearAudioFallbackTimer();
    state.audioNextTime = 0;
    state.audioMode = "web_audio";

    state.audioFallbackTimer = window.setTimeout(function() {
      if (state.audioMode === "web_audio" && state.audioSocket === ws) {
        try {
          ws.close();
        } catch (error) {
          // Ignore close errors during fallback.
        }
        startFallbackAudioStream().catch(function() {
          stopAudioStream();
          showOverlay(tr("overlay_audio_failed"));
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
          // Ignore close errors.
        }
      }
      startFallbackAudioStream().catch(function() {
        stopAudioStream();
        showOverlay(tr("overlay_audio_failed"));
        window.setTimeout(hideOverlay, 1600);
      });
    });
  }).catch(function() {
    startFallbackAudioStream().catch(function() {
      stopAudioStream();
      showOverlay(tr("overlay_audio_start_failed"));
      window.setTimeout(hideOverlay, 1600);
    });
  });
}

function toggleAudioStream(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  if (state.soundEnabled) {
    stopAudioStream();
  } else {
    startAudioStream();
  }
}

function requestLandscapeMode() {
  if (screen.orientation && screen.orientation.lock) {
    screen.orientation.lock("landscape").catch(function() {
      // Ignore lock failures on unsupported browsers.
    });
  }
}

window.addEventListener("resize", function() {
  syncCursorFromRatios();
}, false);

if (mobileKeyboardBridge) {
  mobileKeyboardBridge.addEventListener("beforeinput", handleBridgeBeforeInput, false);
  mobileKeyboardBridge.addEventListener("input", handleBridgeInput, false);
  mobileKeyboardBridge.addEventListener("keydown", handleBridgeKeydown, false);
  mobileKeyboardBridge.addEventListener("compositionend", handleBridgeCompositionEnd, false);
  resetKeyboardBridge();
}

connectButton.addEventListener("click", startConnectFlow, false);
settingsLauncher.addEventListener("click", openSettings, false);
viewerSettingsButton.addEventListener("click", openSettings, false);
closeSettingsButton.addEventListener("click", function() {
  persistSettingsFromSheet();
  closeSettings();
}, false);
settingsSheet.addEventListener("click", function(event) {
  if (event.target === settingsSheet) {
    persistSettingsFromSheet();
    closeSettings();
  }
}, false);
languageSelect.addEventListener("change", persistSettingsFromSheet, false);
autoSearchToggle.addEventListener("change", persistSettingsFromSheet, false);
hostInput.addEventListener("change", persistSettingsFromSheet, false);
portInput.addEventListener("change", persistSettingsFromSheet, false);
loginForm.addEventListener("submit", performLogin, false);
cancelLoginButton.addEventListener("click", function() {
  hideLoginSheet();
  showLoginStatus("");
}, false);
keyboardIconButton.addEventListener("click", openKeyboardBridge, false);
soundIconButton.addEventListener("click", toggleAudioStream, false);
displayButton.addEventListener("click", cycleDisplay, false);

if ("ontouchstart" in window) {
  mobileViewport.addEventListener("touchstart", onTouchStart, false);
  mobileViewport.addEventListener("touchmove", onTouchMove, false);
  mobileViewport.addEventListener("touchend", onTouchEnd, false);
  mobileViewport.addEventListener("touchcancel", onTouchCancel, false);
} else if (window.PointerEvent) {
  mobileViewport.addEventListener("pointerdown", onPointerDown, false);
  mobileViewport.addEventListener("pointermove", onPointerMove, false);
  mobileViewport.addEventListener("pointerup", onPointerUp, false);
  mobileViewport.addEventListener("pointercancel", onPointerCancel, false);
}

mobileViewport.addEventListener("contextmenu", function(event) {
  event.preventDefault();
}, false);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", function() {
    navigator.serviceWorker.register("/service-worker.js").catch(function() {
      // Ignore service worker registration failures.
    });
  });
}

loadSettings();
applyTranslations();
languageSelect.value = state.settings.language;
autoSearchToggle.checked = !!state.settings.autoSearch;
hostInput.value = state.settings.host;
portInput.value = state.settings.port;
updateSoundVisibility();
