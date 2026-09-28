"use strict";

(function () {
    const Data = window.LeaderboardData;

    if (!Data) {
        console.error("❌ LeaderboardData introuvable");
        return;
    }

    function getRankColor(rank) {
        if (rank === 1) return "#173f91";
        if (rank === 2) return "#b84d4d";
        if (rank === 3) return "#cd7f32";
        return "#f1c40f";
    }

    function getRankShadow(rank) {
        if (rank === 1) return "rgba(35,90,220,.75)";
        if (rank === 2) return "rgba(190,50,50,.65)";
        if (rank === 3) return "rgba(255,170,45,.9)";
        return "rgba(241,196,15,.35)";
    }

    function createRankTitle(rank, type) {
        const title = Data.getRankTitle(rank, type);

        if (!title) return null;

        return {
            text: title.text,
            rank,
            type,
            color: getRankColor(rank),
            shadow: getRankShadow(rank)
        };
    }

    function getPlayerName() {
        return (
            localStorage.getItem("surviveio_nickname") ||
            "Player"
        );
    }

    /*
     * Les classements réels seront alimentés par la source
     * de données du leaderboard.
     *
     * Format attendu :
     *
     * window.DeadlyLeaderboard.rankings = {
     *   score:  [{ name: "...", score: 500 }],
     *   waves:  [{ name: "...", waves: 20 }],
     *   kills:  [{ name: "...", kills: 100 }]
     * };
     */

    function getRankings() {
        return window.DeadlyLeaderboard.rankings || {
            score: [],
            waves: [],
            kills: []
        };
    }

    function findPlayerRank(type, playerName) {
        const rankings = getRankings();
        const entries = Array.isArray(rankings[type])
            ? rankings[type]
            : [];

        const index = entries.findIndex(entry =>
            String(entry.name || "").toLowerCase() ===
            String(playerName || "").toLowerCase()
        );

        if (index === -1) return null;

        const rank = index + 1;

        if (rank < 1 || rank > 100) return null;

        return rank;
    }

    function getPlayerRankTitlesForGame() {
        const playerName = getPlayerName();
        const titles = [];

        ["score", "waves", "kills"].forEach(type => {
            const rank = findPlayerRank(type, playerName);

            if (rank) {
                const title = createRankTitle(rank, type);

                if (title) {
                    titles.push(title);
                }
            }
        });

        return titles;
    }

    function getPlayerRankTitles() {
        const playerName = getPlayerName();
        const result = [];

        ["score", "waves", "kills"].forEach(type => {
            const rank = findPlayerRank(type, playerName);

            if (rank) {
                result.push({
                    ...createRankTitle(rank, type),
                    type
                });
            }
        });

        return result;
    }


    function renderLeaderboard(type = "score") {
        const rows = document.getElementById("leaderboard-rows");
        if (!rows) return;

        const rankings = getRankings();
        const entries = Array.isArray(rankings[type])
            ? rankings[type].slice(0, 100)
            : [];

        rows.innerHTML = "";

        for (let i = 0; i < 100; i++) {
            const rank = i + 1;
            const entry = entries[i];

            const row = document.createElement("div");
            row.className = "leader-row";

            const rankElement = document.createElement("span");
            rankElement.textContent = rank;

            const playerElement = document.createElement("span");

            const nameElement = document.createElement("strong");
            nameElement.textContent =
                entry?.name || "---";

            playerElement.appendChild(nameElement);

            if (entry?.name) {
                const title = createRankTitle(rank, type);

                if (title) {
                    const titleElement =
                        document.createElement("small");

                    titleElement.className =
                        `leaderboard-rank-title ${
                            Data.getRankStyle(rank) || ""
                        }`;

                    titleElement.textContent = title.text;
                    playerElement.appendChild(titleElement);
                }
            }

            const valueElement = document.createElement("strong");

            let value = 0;

            if (entry) {
                if (type === "score") {
                    value = Number(entry.score) || 0;
                } else if (type === "waves") {
                    value = Number(entry.waves) || 0;
                } else if (type === "kills") {
                    value = Number(entry.kills) || 0;
                }
            }

            valueElement.textContent = value;

            row.appendChild(rankElement);
            row.appendChild(playerElement);
            row.appendChild(valueElement);

            rows.appendChild(row);
        }
    }

    function updateMyLeaderboard(type = "score") {
        const playerName = getPlayerName();
        const rank = findPlayerRank(type, playerName);

        const rankElement =
            document.querySelector(".my-leaderboard-rank");

        if (rankElement) {
            rankElement.textContent =
                rank ? `#${rank}` : "#---";
        }

        const stats = {
            score: "my-rank-score",
            waves: "my-rank-waves",
            kills: "my-rank-kills"
        };

        const rankings = getRankings();

        ["score", "waves", "kills"].forEach(stat => {
            const element =
                document.getElementById(stats[stat]);

            if (!element) return;

            const entries = Array.isArray(rankings[stat])
                ? rankings[stat]
                : [];

            const player = entries.find(entry =>
                String(entry.name || "").toLowerCase() ===
                String(playerName || "").toLowerCase()
            );

            element.textContent =
                player?.[stat] ?? 0;
        });
    }

    window.renderDeadlyLeaderboard = renderLeaderboard;
    window.updateMyDeadlyLeaderboard = updateMyLeaderboard;


    function setRankings(data) {
        if (!data || typeof data !== "object") return;

        window.DeadlyLeaderboard.rankings = {
            score: Array.isArray(data.score) ? data.score : [],
            waves: Array.isArray(data.waves) ? data.waves : [],
            kills: Array.isArray(data.kills) ? data.kills : []
        };

        const activeTab =
            document.querySelector(
                "#leaderboard-panel .leaderboard-tabs button.active"
            );

        const tabs = Array.from(
            document.querySelectorAll(
                "#leaderboard-panel .leaderboard-tabs button"
            )
        );

        const index = Math.max(
            0,
            tabs.indexOf(activeTab)
        );

        const types = ["score", "waves", "kills"];
        const type = types[index] || "score";

        if (typeof window.renderDeadlyLeaderboard === "function") {
            window.renderDeadlyLeaderboard(type);
        }

        if (typeof window.updateMyDeadlyLeaderboard === "function") {
            window.updateMyDeadlyLeaderboard(type);
        }
    }

    window.DeadlyLeaderboard = {
        rankings: {
            score: [],
            waves: [],
            kills: []
        },

        createRankTitle,
        getPlayerRankTitlesForGame,
        getPlayerRankTitles,
        findPlayerRank,
        getRankColor,
        getRankShadow,
        setRankings
    };

    console.log("✅ Système de titres Top 1 → Top 100 chargé");
})();

(function () {
    const tabs = document.querySelectorAll(
        "#leaderboard-panel .leaderboard-tabs button"
    );

    if (!tabs.length) return;

    const types = ["score", "waves", "kills"];

    tabs.forEach((tab, index) => {
        tab.addEventListener("click", () => {
            tabs.forEach(button =>
                button.classList.remove("active")
            );

            tab.classList.add("active");

            const type = types[index];

            if (typeof window.renderDeadlyLeaderboard === "function") {
                window.renderDeadlyLeaderboard(type);
            }

            if (typeof window.updateMyDeadlyLeaderboard === "function") {
                window.updateMyDeadlyLeaderboard(type);
            }
        });
    });

    window.renderDeadlyLeaderboard?.("score");
    window.updateMyDeadlyLeaderboard?.("score");

    console.log("✅ Onglets SCORE / VAGUES / ZOMBIES connectés");
})();
