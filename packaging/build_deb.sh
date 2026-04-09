#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
BUILD_DIR="$ROOT_DIR/build/deb"
PACKAGE_NAME="netron-computer"
VERSION="${1:-1.04}"
ARCH="$(uname -m)"
PACKAGE_DIR="$BUILD_DIR/${PACKAGE_NAME}_${VERSION}_${ARCH}"
ICON_NAME="ntrn.png"

case "$ARCH" in
  x86_64)
    ARCH="amd64"
    ;;
  aarch64)
    ARCH="arm64"
    ;;
esac

rm -rf "$PACKAGE_DIR"
mkdir -p "$PACKAGE_DIR/DEBIAN" "$PACKAGE_DIR/usr/bin" "$PACKAGE_DIR/usr/share/applications"
mkdir -p "$PACKAGE_DIR/usr/share/icons/hicolor/256x256/apps"
mkdir -p "$PACKAGE_DIR/opt/$PACKAGE_NAME"

cp -R "$ROOT_DIR/netron_computer" "$PACKAGE_DIR/opt/$PACKAGE_NAME/"
cp "$ROOT_DIR/pyproject.toml" "$PACKAGE_DIR/opt/$PACKAGE_NAME/"
cp "$ROOT_DIR/README.md" "$PACKAGE_DIR/opt/$PACKAGE_NAME/"
cp "$ROOT_DIR/packaging/netron-computer.desktop" "$PACKAGE_DIR/usr/share/applications/"
cp "$ROOT_DIR/netron_computer/assets/app-icon.png" "$PACKAGE_DIR/usr/share/icons/hicolor/256x256/apps/$ICON_NAME"

cat > "$PACKAGE_DIR/usr/bin/netron-computer-desktop" <<'EOF'
#!/bin/sh
export PYTHONPATH="/opt/netron-computer:${PYTHONPATH:-}"
cd /opt/netron-computer
exec /usr/bin/env python3 -m netron_computer.desktop_app
EOF
chmod +x "$PACKAGE_DIR/usr/bin/netron-computer-desktop"

cat > "$PACKAGE_DIR/DEBIAN/control" <<EOF
Package: $PACKAGE_NAME
Version: $VERSION
Section: utils
Priority: optional
Architecture: $ARCH
Maintainer: Netronru <netronrus@gmail.com>
Depends: python3, python3-tk, ffmpeg
Description: Netron-Computer desktop launcher
 Desktop launcher and controller for Netron-Computer screen sharing.
EOF

mkdir -p "$DIST_DIR"
if command -v dpkg-deb >/dev/null 2>&1; then
  dpkg-deb --build "$PACKAGE_DIR" "$DIST_DIR/${PACKAGE_NAME}_${VERSION}_${ARCH}.deb"
else
  TMP_DIR="$BUILD_DIR/tmp"
  CONTROL_ARCHIVE="$TMP_DIR/control.tar.gz"
  DATA_ARCHIVE="$TMP_DIR/data.tar.xz"
  rm -rf "$TMP_DIR"
  mkdir -p "$TMP_DIR"
  printf '2.0\n' > "$TMP_DIR/debian-binary"
  (
    cd "$PACKAGE_DIR/DEBIAN"
    tar --owner=0 --group=0 --numeric-owner -czf "$CONTROL_ARCHIVE" .
  )
  (
    cd "$PACKAGE_DIR"
    tar --owner=0 --group=0 --numeric-owner -cJf "$DATA_ARCHIVE" --exclude=DEBIAN .
  )
  ar rcs "$DIST_DIR/${PACKAGE_NAME}_${VERSION}_${ARCH}.deb" \
    "$TMP_DIR/debian-binary" \
    "$CONTROL_ARCHIVE" \
    "$DATA_ARCHIVE"
fi
printf 'Built %s\n' "$DIST_DIR/${PACKAGE_NAME}_${VERSION}_${ARCH}.deb"
