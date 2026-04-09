package com.netronru.netroncomputer

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

data class ServerEndpoint(
    val baseUrl: String,
    val audioEnabled: Boolean,
)

data class LoginResult(
    val token: String,
    val audioEnabled: Boolean,
)

object Discovery {
    private val jsonMediaType = "application/json".toMediaType()
    private val client = OkHttpClient()

    suspend fun discover(settings: StoredSettings): ServerEndpoint = withContext(Dispatchers.IO) {
        val candidates = buildCandidates(settings)
        for (candidate in candidates) {
            val request = Request.Builder()
                .url("$candidate/api/public-config")
                .get()
                .build()

            runCatching {
                client.newCall(request).execute().use { response ->
                    if (!response.isSuccessful) {
                        return@use null
                    }

                    val body = response.body?.string().orEmpty()
                    val json = JSONObject(body)
                    return@withContext ServerEndpoint(
                        baseUrl = candidate,
                        audioEnabled = json.optBoolean("audio_enabled", true),
                    )
                }
            }
        }

        throw IllegalStateException("Server not found")
    }

    suspend fun login(endpoint: ServerEndpoint, username: String, password: String): LoginResult =
        withContext(Dispatchers.IO) {
            val payload = JSONObject()
                .put("username", username)
                .put("password", password)
                .toString()
                .toRequestBody(jsonMediaType)

            val request = Request.Builder()
                .url("${endpoint.baseUrl}/api/auth/login")
                .post(payload)
                .build()

            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    throw IllegalStateException("Login failed")
                }

                val body = response.body?.string().orEmpty()
                val json = JSONObject(body)
                return@withContext LoginResult(
                    token = json.getString("token"),
                    audioEnabled = json.optBoolean("audio_enabled", true),
                )
            }
        }

    private fun buildCandidates(settings: StoredSettings): List<String> {
        val host = settings.host
            .removePrefix("http://")
            .removePrefix("https://")
            .trimEnd('/')
            .ifBlank { "127.0.0.1" }
        val ports = mutableListOf(settings.port)
        if (settings.autoSearch) {
            listOf(1, -1, 2, -2, 10).forEach { offset ->
                val candidate = settings.port + offset
                if (candidate in 1..65535 && candidate !in ports) {
                    ports += candidate
                }
            }
        }

        return ports.map { port ->
            "http://$host:$port"
        }
    }
}
