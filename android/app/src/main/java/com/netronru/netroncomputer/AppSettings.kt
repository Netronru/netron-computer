package com.netronru.netroncomputer

import android.content.Context

enum class AppLanguage {
    EN,
    RU,
    ES;

    companion object {
        fun fromCode(code: String?): AppLanguage {
            return when (code?.lowercase()) {
                "ru" -> RU
                "es" -> ES
                else -> EN
            }
        }
    }

    fun code(): String = when (this) {
        EN -> "en"
        RU -> "ru"
        ES -> "es"
    }
}

data class StoredSettings(
    val host: String,
    val port: Int,
    val autoSearch: Boolean,
    val language: AppLanguage,
)

class AppSettings(context: Context) {
    private val preferences = context.getSharedPreferences("netron_computer_android", Context.MODE_PRIVATE)

    fun load(): StoredSettings {
        return StoredSettings(
            host = preferences.getString("host", "127.0.0.1").orEmpty().ifBlank { "127.0.0.1" },
            port = preferences.getInt("port", 3001),
            autoSearch = preferences.getBoolean("auto_search", true),
            language = AppLanguage.fromCode(preferences.getString("language", "en")),
        )
    }

    fun save(settings: StoredSettings) {
        preferences.edit()
            .putString("host", settings.host)
            .putInt("port", settings.port)
            .putBoolean("auto_search", settings.autoSearch)
            .putString("language", settings.language.code())
            .apply()
    }
}
