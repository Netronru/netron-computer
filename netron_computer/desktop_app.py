from __future__ import annotations

import os
import socket
import subprocess
import sys
from pathlib import Path

from netron_computer.config_store import ROOT_DIR, parse_env, save_env

LOG_PATH = ROOT_DIR / "netron-computer.log"
APP_ICON_ICO = ROOT_DIR / "netron_computer" / "assets" / "app-icon.ico"
APP_ICON_PNG = ROOT_DIR / "netron_computer" / "assets" / "app-icon.png"

TRANSLATIONS = {
    "en": {
        "window_title": "NTRN",
        "share": "Share screen",
        "stop": "Stop",
        "settings": "Settings",
        "settings_title": "Settings",
        "allow_audio": "Allow sound streaming",
        "username": "Username",
        "password": "Password",
        "port": "Port",
        "language": "Language",
        "apply": "Apply",
        "close": "Close",
        "running": "Your screen is being shared. Sign in from another device at 127.0.0.1:{port}, or install the Android app.",
        "running_extra": "Local network address: {ip}:{port}",
        "stopped": "Screen sharing is stopped.",
        "save_error": "Could not save settings.",
        "start_error": "Could not start screen sharing. Check netron-computer.log for details.",
        "audio_on": "Enabled",
        "audio_off": "Disabled",
        "lang_en": "English",
        "lang_ru": "Russian",
        "lang_es": "Spanish",
    },
    "ru": {
        "window_title": "NTRN",
        "share": "Раздать экран",
        "stop": "Остановить",
        "settings": "Настройки",
        "settings_title": "Настройки",
        "allow_audio": "Разрешить передачу звука",
        "username": "Логин",
        "password": "Пароль",
        "port": "Порт",
        "language": "Язык",
        "apply": "Применить",
        "close": "Закрыть",
        "running": "Ваш экран передается, войдите на другом устройстве по 127.0.0.1:{port}, или установите приложение на Android.",
        "running_extra": "Адрес в локальной сети: {ip}:{port}",
        "stopped": "Передача экрана остановлена.",
        "save_error": "Не удалось сохранить настройки.",
        "start_error": "Не удалось запустить передачу экрана. Проверьте netron-computer.log.",
        "audio_on": "Включено",
        "audio_off": "Выключено",
        "lang_en": "Английский",
        "lang_ru": "Русский",
        "lang_es": "Испанский",
    },
    "es": {
        "window_title": "NTRN",
        "share": "Compartir pantalla",
        "stop": "Detener",
        "settings": "Ajustes",
        "settings_title": "Ajustes",
        "allow_audio": "Permitir transmisión de audio",
        "username": "Usuario",
        "password": "Contraseña",
        "port": "Puerto",
        "language": "Idioma",
        "apply": "Aplicar",
        "close": "Cerrar",
        "running": "Tu pantalla se está compartiendo. Inicia sesión desde otro dispositivo en 127.0.0.1:{port}, o instala la app de Android.",
        "running_extra": "Dirección en la red local: {ip}:{port}",
        "stopped": "La transmisión de pantalla está detenida.",
        "save_error": "No se pudieron guardar los ajustes.",
        "start_error": "No se pudo iniciar la transmisión de pantalla. Revisa netron-computer.log.",
        "audio_on": "Activado",
        "audio_off": "Desactivado",
        "lang_en": "Inglés",
        "lang_ru": "Ruso",
        "lang_es": "Español",
    },
}

LANGUAGE_OPTIONS = [("en", "lang_en"), ("ru", "lang_ru"), ("es", "lang_es")]


def local_ipv4() -> str:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("8.8.8.8", 80))
        return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        sock.close()


class DesktopApp:
    def __init__(self) -> None:
        import tkinter as tk
        from tkinter import ttk

        self.tk = tk
        self.ttk = ttk
        self.messagebox = __import__("tkinter.messagebox", fromlist=["messagebox"])
        self.window_icon = None
        self.root = tk.Tk(className="NTRN")
        self.root.geometry("520x250")
        self.root.minsize(460, 220)
        self.root.configure(bg="#111111")
        self.root.protocol("WM_DELETE_WINDOW", self.on_close)
        self.root.iconname("NTRN")

        self.server_process: subprocess.Popen[bytes] | None = None
        self.server_log_handle = None
        self.config = parse_env()
        self.language = self._sanitize_language(self.config.get("LANGUAGE", "en"))

        self.top_bar = tk.Frame(self.root, bg="#111111")
        self.top_bar.pack(fill="x", padx=16, pady=(16, 8))

        self.settings_button = tk.Button(
            self.top_bar,
            text="⚙",
            command=self.open_settings,
            bg="#1f1f1f",
            fg="#ffffff",
            relief="flat",
            font=("Helvetica", 16, "bold"),
            padx=12,
            pady=6,
            cursor="hand2",
        )
        self.settings_button.pack(side="right")

        self.body = tk.Frame(self.root, bg="#111111")
        self.body.pack(fill="both", expand=True, padx=20, pady=8)

        self.share_button = tk.Button(
            self.body,
            command=self.toggle_server,
            bg="#ffffff",
            fg="#000000",
            relief="flat",
            font=("Helvetica", 18, "bold"),
            padx=24,
            pady=16,
            cursor="hand2",
        )
        self.share_button.pack(pady=(18, 14))

        self.status_label = tk.Label(
            self.body,
            text="",
            wraplength=440,
            justify="center",
            bg="#111111",
            fg="#eaeaea",
            font=("Helvetica", 11),
        )
        self.status_label.pack(pady=(0, 6))

        self.extra_label = tk.Label(
            self.body,
            text="",
            wraplength=440,
            justify="center",
            bg="#111111",
            fg="#999999",
            font=("Helvetica", 10),
        )
        self.extra_label.pack()

        self.apply_window_identity(self.root)
        self.apply_translations()
        self.refresh_status()
        self.root.after(1200, self.monitor_server)

    def _sanitize_language(self, value: str) -> str:
        return value if value in TRANSLATIONS else "en"

    def t(self, key: str) -> str:
        return TRANSLATIONS[self.language][key]

    def apply_window_identity(self, window) -> None:
        try:
            if APP_ICON_ICO.exists():
                window.iconbitmap(default=str(APP_ICON_ICO))
        except Exception:
            pass

        try:
            if APP_ICON_PNG.exists():
                self.window_icon = self.tk.PhotoImage(file=str(APP_ICON_PNG))
                window.iconphoto(True, self.window_icon)
        except Exception:
            pass

        try:
            window.iconname("NTRN")
        except Exception:
            pass

    def run(self) -> None:
        self.root.mainloop()

    def apply_translations(self) -> None:
        self.root.title(self.t("window_title"))
        self.settings_button.configure(text="⚙")
        self.refresh_status()

    def refresh_status(self) -> None:
        is_running = self.server_process is not None and self.server_process.poll() is None
        port = self.config.get("PORT", "3001")
        if is_running:
            self.share_button.configure(text=self.t("stop"))
            self.status_label.configure(text=self.t("running").format(port=port))
            self.extra_label.configure(text=self.t("running_extra").format(ip=local_ipv4(), port=port))
        else:
            self.share_button.configure(text=self.t("share"))
            self.status_label.configure(text=self.t("stopped"))
            self.extra_label.configure(text="")

    def start_server(self) -> None:
        if self.server_process is not None and self.server_process.poll() is None:
            return

        self.stop_server()
        self.server_log_handle = LOG_PATH.open("ab")
        self.server_process = subprocess.Popen(
            [sys.executable, "-m", "netron_computer"],
            cwd=str(ROOT_DIR),
            stdout=self.server_log_handle,
            stderr=subprocess.STDOUT,
            env=os.environ.copy(),
        )
        self.root.after(700, self.verify_started)
        self.refresh_status()

    def verify_started(self) -> None:
        if self.server_process is None:
            return
        if self.server_process.poll() is not None:
            self.refresh_status()
            self.messagebox.showerror(self.t("window_title"), self.t("start_error"))

    def stop_server(self) -> None:
        if self.server_process is not None and self.server_process.poll() is None:
            self.server_process.terminate()
            try:
                self.server_process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                self.server_process.kill()
                self.server_process.wait(timeout=3)
        self.server_process = None
        if self.server_log_handle is not None:
            self.server_log_handle.close()
            self.server_log_handle = None
        self.refresh_status()

    def toggle_server(self) -> None:
        if self.server_process is not None and self.server_process.poll() is None:
            self.stop_server()
        else:
            self.start_server()

    def monitor_server(self) -> None:
        if self.server_process is not None and self.server_process.poll() is not None:
            self.server_process = None
            if self.server_log_handle is not None:
                self.server_log_handle.close()
                self.server_log_handle = None
            self.refresh_status()
        self.root.after(1200, self.monitor_server)

    def open_settings(self) -> None:
        tk = self.tk
        ttk = self.ttk
        dialog = tk.Toplevel(self.root)
        dialog.title(self.t("settings_title"))
        dialog.configure(bg="#151515")
        dialog.transient(self.root)
        dialog.grab_set()
        dialog.resizable(False, False)
        self.apply_window_identity(dialog)

        form = ttk.Frame(dialog, padding=18)
        form.pack(fill="both", expand=True)

        audio_var = tk.BooleanVar(value=self.config.get("ENABLE_AUDIO", "1") not in {"0", "false", "no", "off"})
        username_var = tk.StringVar(value=self.config.get("AUTH_USERNAME", "admin"))
        password_var = tk.StringVar(value=self.config.get("AUTH_PASSWORD", "admin"))
        port_var = tk.StringVar(value=self.config.get("PORT", "3001"))
        language_var = tk.StringVar(value=self.language)

        ttk.Checkbutton(form, text=self.t("allow_audio"), variable=audio_var).grid(
            row=0, column=0, columnspan=2, sticky="w", pady=(0, 12)
        )

        ttk.Label(form, text=self.t("username")).grid(row=1, column=0, sticky="w", pady=4)
        ttk.Entry(form, textvariable=username_var, width=28).grid(row=1, column=1, sticky="ew", pady=4)

        ttk.Label(form, text=self.t("password")).grid(row=2, column=0, sticky="w", pady=4)
        ttk.Entry(form, textvariable=password_var, width=28, show="*").grid(row=2, column=1, sticky="ew", pady=4)

        ttk.Label(form, text=self.t("port")).grid(row=3, column=0, sticky="w", pady=4)
        ttk.Entry(form, textvariable=port_var, width=28).grid(row=3, column=1, sticky="ew", pady=4)

        ttk.Label(form, text=self.t("language")).grid(row=4, column=0, sticky="w", pady=4)
        language_names = {code: self.t(label_key) for code, label_key in LANGUAGE_OPTIONS}
        language_combo = ttk.Combobox(
            form,
            state="readonly",
            values=[language_names[code] for code, _ in LANGUAGE_OPTIONS],
            width=25,
        )
        selected_index = 0
        for index, (code, _) in enumerate(LANGUAGE_OPTIONS):
            if code == language_var.get():
                selected_index = index
                break
        language_combo.current(selected_index)
        language_combo.grid(row=4, column=1, sticky="ew", pady=4)

        buttons = ttk.Frame(form)
        buttons.grid(row=5, column=0, columnspan=2, sticky="e", pady=(14, 0))

        def apply_settings() -> None:
            selected_language = LANGUAGE_OPTIONS[language_combo.current()][0]
            try:
                port_value = str(int(port_var.get().strip()))
            except ValueError:
                self.messagebox.showerror(self.t("settings_title"), self.t("save_error"))
                return

            updates = {
                "ENABLE_AUDIO": "1" if audio_var.get() else "0",
                "AUTH_USERNAME": username_var.get().strip() or "admin",
                "AUTH_PASSWORD": password_var.get().strip() or "admin",
                "PORT": port_value,
                "LANGUAGE": selected_language,
            }

            try:
                save_env(updates)
            except Exception:
                self.messagebox.showerror(self.t("settings_title"), self.t("save_error"))
                return

            was_running = self.server_process is not None and self.server_process.poll() is None
            self.config.update(updates)
            self.language = selected_language
            self.apply_translations()
            if was_running:
                self.stop_server()
                self.start_server()
            else:
                self.refresh_status()

        ttk.Button(buttons, text=self.t("apply"), command=apply_settings).pack(side="left", padx=(0, 8))
        ttk.Button(buttons, text=self.t("close"), command=dialog.destroy).pack(side="left")

        form.columnconfigure(1, weight=1)

    def on_close(self) -> None:
        self.stop_server()
        self.root.destroy()


def main() -> None:
    try:
        DesktopApp().run()
    except ModuleNotFoundError as exc:
        if exc.name == "tkinter":
            print("tkinter is required for netron-computer-desktop. Install python3-tk and try again.")
            raise SystemExit(1) from exc
        raise
