"use strict";

const LEADERBOARD_TYPES = {
    score: {
        key: "surviveio_score",
        label: "Score"
    },
    waves: {
        key: "surviveio_waves",
        label: "Vagues"
    },
    kills: {
        key: "surviveio_kills",
        label: "Zombies"
    }
};

function getRankTitle(rank, type) {
    if (!rank || rank < 1 || rank > 100) return null;

    const label = LEADERBOARD_TYPES[type]?.label || type;

    return {
        rank,
        type,
        label,
        text: `#Rank ${rank} ${label}`
    };
}

function getRankStyle(rank) {
    if (rank === 1) return "rank-top-1";
    if (rank === 2) return "rank-top-2";
    if (rank === 3) return "rank-top-3";
    if (rank >= 4 && rank <= 100) return "rank-top-normal";
    return null;
}

window.LeaderboardData = {
    LEADERBOARD_TYPES,
    getRankTitle,
    getRankStyle
};
