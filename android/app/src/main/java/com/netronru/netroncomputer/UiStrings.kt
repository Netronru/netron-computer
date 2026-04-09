package com.netronru.netroncomputer

object UiStrings {
    fun appTitle(language: AppLanguage): String = when (language) {
        AppLanguage.EN -> "NTRN"
        AppLanguage.RU -> "NTRN"
        AppLanguage.ES -> "NTRN"
    }

    fun connect(language: AppLanguage): String = when (language) {
        AppLanguage.EN -> "Connect"
        AppLanguage.RU -> "Подключиться"
        AppLanguage.ES -> "Conectar"
    }

    fun connectIdle(language: AppLanguage): String = when (language) {
        AppLanguage.EN -> "Tap Connect to find your computer on the local network."
        AppLanguage.RU -> "Нажмите Подключиться, чтобы найти компьютер в локальной сети."
        AppLanguage.ES -> "Pulsa Conectar para encontrar tu computadora en la red local."
    }

    fun connectSearching(language: AppLanguage): String = when (language) {
        AppLanguage.EN -> "Searching for your computer..."
        AppLanguage.RU -> "Ищем ваш компьютер..."
        AppLanguage.ES -> "Buscando tu computadora..."
    }

    fun connectFailed(language: AppLanguage): String = when (language) {
        AppLanguage.EN -> "Could not find an NTRN server. Check Wi-Fi and port settings."
        AppLanguage.RU -> "Не удалось найти сервер NTRN. Проверьте Wi-Fi и настройки порта."
        AppLanguage.ES -> "No se pudo encontrar un servidor NTRN. Revisa el Wi-Fi y el puerto."
    }

    fun vpnWarningTitle(language: AppLanguage): String = when (language) {
        AppLanguage.EN -> "VPN is enabled"
        AppLanguage.RU -> "VPN включен"
        AppLanguage.ES -> "VPN activado"
    }

    fun vpnWarningMessage(language: AppLanguage): String = when (language) {
        AppLanguage.EN -> "Connection problems may occur while VPN is enabled. If the app cannot find your computer, disable VPN and try again."
        AppLanguage.RU -> "При включенном VPN могут возникать проблемы с подключением. Если приложение не находит компьютер, выключите VPN и попробуйте снова."
        AppLanguage.ES -> "Pueden producirse problemas de conexión mientras el VPN está activado. Si la app no encuentra tu computadora, desactiva el VPN e inténtalo de nuevo."
    }

    fun ok(language: AppLanguage): String = when (language) {
        AppLanguage.EN -> "OK"
        AppLanguage.RU -> "Понятно"
        AppLanguage.ES -> "Aceptar"
    }

    fun settings(language: AppLanguage): String = when (language) {
        AppLanguage.EN -> "Settings"
        AppLanguage.RU -> "Настройки"
        AppLanguage.ES -> "Ajustes"
    }

    fun language(language: AppLanguage): String = when (language) {
        AppLanguage.EN -> "Language"
        AppLanguage.RU -> "Язык"
        AppLanguage.ES -> "Idioma"
    }

    fun autoSearch(language: AppLanguage): String = when (language) {
        AppLanguage.EN -> "Auto-search nearby ports"
        AppLanguage.RU -> "Автопоиск соседних портов"
        AppLanguage.ES -> "Buscar puertos cercanos automáticamente"
    }

    fun host(language: AppLanguage): String = when (language) {
        AppLanguage.EN -> "Computer host"
        AppLanguage.RU -> "Адрес компьютера"
        AppLanguage.ES -> "Host del equipo"
    }

    fun port(language: AppLanguage): String = when (language) {
        AppLanguage.EN -> "Starting port"
        AppLanguage.RU -> "Начальный порт"
        AppLanguage.ES -> "Puerto inicial"
    }

    fun apply(language: AppLanguage): String = when (language) {
        AppLanguage.EN -> "Apply"
        AppLanguage.RU -> "Применить"
        AppLanguage.ES -> "Aplicar"
    }

    fun close(language: AppLanguage): String = when (language) {
        AppLanguage.EN -> "Close"
        AppLanguage.RU -> "Закрыть"
        AppLanguage.ES -> "Cerrar"
    }

    fun signIn(language: AppLanguage): String = when (language) {
        AppLanguage.EN -> "Sign in"
        AppLanguage.RU -> "Вход"
        AppLanguage.ES -> "Iniciar sesión"
    }

    fun username(language: AppLanguage): String = when (language) {
        AppLanguage.EN -> "Username"
        AppLanguage.RU -> "Логин"
        AppLanguage.ES -> "Usuario"
    }

    fun password(language: AppLanguage): String = when (language) {
        AppLanguage.EN -> "Password"
        AppLanguage.RU -> "Пароль"
        AppLanguage.ES -> "Contraseña"
    }

    fun back(language: AppLanguage): String = when (language) {
        AppLanguage.EN -> "Back"
        AppLanguage.RU -> "Назад"
        AppLanguage.ES -> "Atrás"
    }

    fun open(language: AppLanguage): String = when (language) {
        AppLanguage.EN -> "Open"
        AppLanguage.RU -> "Открыть"
        AppLanguage.ES -> "Abrir"
    }

    fun loginInProgress(language: AppLanguage): String = when (language) {
        AppLanguage.EN -> "Signing in..."
        AppLanguage.RU -> "Выполняется вход..."
        AppLanguage.ES -> "Iniciando sesión..."
    }

    fun loginFailed(language: AppLanguage): String = when (language) {
        AppLanguage.EN -> "Invalid username or password."
        AppLanguage.RU -> "Неверный логин или пароль."
        AppLanguage.ES -> "Usuario o contraseña incorrectos."
    }

    fun english(language: AppLanguage): String = when (language) {
        AppLanguage.EN -> "English"
        AppLanguage.RU -> "Английский"
        AppLanguage.ES -> "Inglés"
    }

    fun russian(language: AppLanguage): String = when (language) {
        AppLanguage.EN -> "Russian"
        AppLanguage.RU -> "Русский"
        AppLanguage.ES -> "Ruso"
    }

    fun spanish(language: AppLanguage): String = when (language) {
        AppLanguage.EN -> "Spanish"
        AppLanguage.RU -> "Испанский"
        AppLanguage.ES -> "Español"
    }
}
