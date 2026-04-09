# Netron-Computer Android

Native Android client for `netron-computer`.

## What is inside

- native `Connect` screen
- native settings dialog
- native login dialog
- `ViewerActivity` with an embedded full-screen WebView viewer
- landscape-first UI
- icon-based controls inside the viewer

## Open the project

1. Open Android Studio.
2. Choose `Open`.
3. Select the `/android` folder.
4. Let Gradle sync the project.

## Build requirements

- Android Studio Ladybug or newer
- Android SDK 35
- JDK 17

## Current flow

1. Open the app.
2. Tap `Connect`.
3. The app searches the configured host and nearby ports.
4. Enter the computer login and password.
5. After successful login, the remote screen opens in landscape mode.

## Notes

- The app expects the desktop server to be running on the computer.
- Cleartext HTTP is enabled because the current desktop server uses local network HTTP on port `3001`.
- The viewer is embedded inside the app and does not open the system browser.
