"use strict";

const http = require("http");

const PORT = process.env.PORT || 8787;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Variables Supabase manquantes.");
    process.exit(1);
}

function sendJSON(res, status, data) {
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    });

    res.end(JSON.stringify(data));
}

async function supabaseRequest(path, options = {}) {
    const response = await fetch(
        `${SUPABASE_URL}/rest/v1/${path}`,
        {
            ...options,
            headers: {
                "apikey": SUPABASE_KEY,
                "Authorization": `Bearer ${SUPABASE_KEY}`,
                "Content-Type": "application/json",
                ...(options.headers || {})
            }
        }
    );

    const text = await response.text();

    if (!response.ok) {
        throw new Error(
            `Supabase HTTP ${response.status}: ${text}`
        );
    }

    return text ? JSON.parse(text) : null;
}

async function getLeaderboard() {
    const players = await supabaseRequest(
        "players?select=name,score,waves,kills"
    );

    const score = [...players]
        .sort((a, b) => Number(b.score) - Number(a.score))
        .slice(0, 100)
        .map(player => ({
            name: player.name,
            score: Number(player.score) || 0
        }));

    const waves = [...players]
        .sort((a, b) => Number(b.waves) - Number(a.waves))
        .slice(0, 100)
        .map(player => ({
            name: player.name,
            waves: Number(player.waves) || 0
        }));

    const kills = [...players]
        .sort((a, b) => Number(b.kills) - Number(a.kills))
        .slice(0, 100)
        .map(player => ({
            name: player.name,
            kills: Number(player.kills) || 0
        }));

    return {
        score,
        waves,
        kills
    };
}

async function updatePlayer(data) {
    const name = String(data.name || "")
        .trim()
        .slice(0, 16);

    if (!name) {
        throw new Error("Nom invalide");
    }

    const score = Math.max(0, Number(data.score) || 0);
    const waves = Math.max(0, Number(data.waves) || 0);
    const kills = Math.max(0, Number(data.kills) || 0);

    const existing = await supabaseRequest(
        `players?select=id,score,waves,kills&name=eq.${encodeURIComponent(name)}`
    );

    if (existing.length > 0) {
        const player = existing[0];

        await supabaseRequest(
            `players?id=eq.${player.id}`,
            {
                method: "PATCH",
                headers: {
                    "Prefer": "return=minimal"
                },
                body: JSON.stringify({
                    score: Math.max(Number(player.score) || 0, score),
                    waves: Math.max(Number(player.waves) || 0, waves),
                    kills: Math.max(Number(player.kills) || 0, kills),
                    updated_at: new Date().toISOString()
                })
            }
        );
    } else {
        await supabaseRequest(
            "players",
            {
                method: "POST",
                headers: {
                    "Prefer": "return=minimal"
                },
                body: JSON.stringify({
                    name,
                    score,
                    waves,
                    kills
                })
            }
        );
    }
}

const server = http.createServer((req, res) => {
    if (req.method === "OPTIONS") {
        sendJSON(res, 204, {});
        return;
    }

    if (req.method === "GET" && req.url === "/leaderboard") {
        getLeaderboard()
            .then(data => {
                sendJSON(res, 200, data);
            })
            .catch(error => {
                console.error("❌ GET leaderboard :", error.message);

                sendJSON(res, 500, {
                    score: [],
                    waves: [],
                    kills: [],
                    error: "Classement indisponible"
                });
            });

        return;
    }

    if (req.method === "POST" && req.url === "/leaderboard") {
        let body = "";

        req.on("data", chunk => {
            body += chunk;

            if (body.length > 10000) {
                req.destroy();
            }
        });

        req.on("end", () => {
            try {
                const data = JSON.parse(body);

                updatePlayer(data)
                    .then(() => {
                        sendJSON(res, 200, {
                            success: true
                        });
                    })
                    .catch(error => {
                        console.error(
                            "❌ POST leaderboard :",
                            error.message
                        );

                        sendJSON(res, 500, {
                            success: false,
                            error: "Impossible de sauvegarder"
                        });
                    });
            } catch {
                sendJSON(res, 400, {
                    success: false,
                    error: "Données invalides"
                });
            }
        });

        return;
    }

    sendJSON(res, 404, {
        error: "Route introuvable"
    });
});

server.listen(PORT, () => {
    console.log("🏆 Leaderboard connecté à Supabase");
    console.log(`🌐 Port : ${PORT}`);
});
