"use strict";

(function () {
    const API_URL = "https://deadly-leaderboard.onrender.com/leaderboard";

    async function getLeaderboard() {
        try {
            const response = await fetch(API_URL);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.warn("⚠️ Leaderboard indisponible :", error.message);
            return {
                score: [],
                waves: [],
                kills: []
            };
        }
    }

    async function submitPlayerStats() {
        const name =
            localStorage.getItem("surviveio_nickname") ||
            "Player";

        const data = {
            name,
            score:
                Number(localStorage.getItem("surviveio_score")) || 0,
            waves:
                Number(localStorage.getItem("surviveio_waves")) || 0,
            kills:
                Number(localStorage.getItem("surviveio_kills")) || 0
        };

        try {
            const response = await fetch(API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return true;
        } catch (error) {
            console.warn(
                "⚠️ Envoi classement impossible :",
                error.message
            );

            return false;
        }
    }

    async function refreshLeaderboard() {
        const data = await getLeaderboard();

        if (
            window.DeadlyLeaderboard &&
            typeof window.DeadlyLeaderboard.setRankings === "function"
        ) {
            window.DeadlyLeaderboard.setRankings(data);
        }

        return data;
    }

    window.DeadlyLeaderboardAPI = {
        getLeaderboard,
        submitPlayerStats,
        refreshLeaderboard
    };

    console.log("✅ API du classement chargée");
})();
