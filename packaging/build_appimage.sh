#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
APPDIR="$ROOT_DIR/build/AppDir"
DIST_DIR="$ROOT_DIR/dist"
TOOLS_DIR="$ROOT_DIR/build/tools"
VERSION="${1:-1.04}"
APPIMAGETOOL_BIN=""

if command -v appimagetool >/dev/null 2>&1; then
  APPIMAGETOOL_BIN="$(command -v appimagetool)"
else
  mkdir -p "$TOOLS_DIR"
  APPIMAGETOOL_BIN="$TOOLS_DIR/appimagetool-x86_64.AppImage"
  if [ ! -x "$APPIMAGETOOL_BIN" ]; then
    curl -L "https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage" -o "$APPIMAGETOOL_BIN"
    chmod +x "$APPIMAGETOOL_BIN"
  fi
fi

rm -rf "$APPDIR"
mkdir -p "$APPDIR/usr/bin" "$APPDIR/usr/share/applications" "$APPDIR/usr/share/icons/hicolor/256x256/apps"
cp -R "$ROOT_DIR/netron_computer" "$APPDIR/usr/"
cp "$ROOT_DIR/packaging/netron-computer.desktop" "$APPDIR/usr/share/applications/"
cp "$ROOT_DIR/netron_computer/assets/app-icon.png" "$APPDIR/usr/share/icons/hicolor/256x256/apps/ntrn.png"

cat > "$APPDIR/usr/bin/netron-computer-desktop" <<'EOF'
#!/bin/sh
APPDIR="$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)"
export PYTHONPATH="$APPDIR/usr:${PYTHONPATH:-}"
cd "$APPDIR/usr"
exec /usr/bin/env python3 -m netron_computer.desktop_app
EOF
chmod +x "$APPDIR/usr/bin/netron-computer-desktop"

cat > "$APPDIR/AppRun" <<'EOF'
#!/bin/sh
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
export PYTHONPATH="$SCRIPT_DIR/usr:${PYTHONPATH:-}"
exec "$SCRIPT_DIR/usr/bin/netron-computer-desktop"
EOF
chmod +x "$APPDIR/AppRun"

cp "$ROOT_DIR/packaging/netron-computer.desktop" "$APPDIR/netron-computer.desktop"
cp "$ROOT_DIR/netron_computer/assets/app-icon.png" "$APPDIR/ntrn.png"

mkdir -p "$DIST_DIR"
ARCH=x86_64 "$APPIMAGETOOL_BIN" --appimage-extract-and-run "$APPDIR" "$DIST_DIR/NTRN-${VERSION}.AppImage"
printf 'Built %s\n' "$DIST_DIR/NTRN-${VERSION}.AppImage"
