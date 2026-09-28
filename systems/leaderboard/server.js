"use strict";

const http = require("http");

const PORT = 8787;

const rankings = {
    score: [],
    waves: [],
    kills: []
};

function sendJSON(res, status, data) {
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    });

    res.end(JSON.stringify(data));
}

function sortRanking(type) {
    rankings[type].sort((a, b) => {
        return Number(b[type]) - Number(a[type]);
    });

    rankings[type] = rankings[type].slice(0, 100);
}

function updatePlayer(data) {
    const name = String(data.name || "").trim().slice(0, 16);

    if (!name) return;

    ["score", "waves", "kills"].forEach(type => {
        const value = Math.max(
            0,
            Number(data[type]) || 0
        );

        const existing = rankings[type].find(
            player => player.name === name
        );

        if (existing) {
            existing[type] = Math.max(
                Number(existing[type]) || 0,
                value
            );
        } else {
            rankings[type].push({
                name,
                [type]: value
            });
        }

        sortRanking(type);
    });
}

const server = http.createServer((req, res) => {
    if (req.method === "OPTIONS") {
        sendJSON(res, 204, {});
        return;
    }

    if (req.method === "GET" && req.url === "/leaderboard") {
        sendJSON(res, 200, rankings);
        return;
    }

    if (
        req.method === "POST" &&
        req.url === "/leaderboard"
    ) {
        let body = "";

        req.on("data", chunk => {
            body += chunk;
        });

        req.on("end", () => {
            try {
                const data = JSON.parse(body);

                updatePlayer(data);

                sendJSON(res, 200, {
                    success: true
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
    console.log(`🏆 Leaderboard Server : http://localhost:${PORT}`);
});
