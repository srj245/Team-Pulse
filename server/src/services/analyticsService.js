const db = require("../db");

function formatUtcDay(date) {
  return date.toISOString().slice(0, 10);
}

function getDaySeries(days) {
  const dates = [];
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (days - 1));

  for (let index = 0; index < days; index += 1) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    dates.push(formatUtcDay(date));
  }

  return dates;
}

async function getCheckinsPerDay(days = 14) {
  const daySeries = getDaySeries(days);
  const rows = await db.queryMany("checkins", {
    filter: {
      timestamp: {
        $gte: `${daySeries[0]} 00:00:00`,
      },
    },
    projection: ["timestamp"],
  });
  const counts = new Map();

  rows.forEach((row) => {
    const day = String(row.timestamp).slice(0, 10);
    counts.set(day, (counts.get(day) || 0) + 1);
  });

  return daySeries.map((day) => ({
    date: day,
    checkinCount: counts.get(day) || 0,
  }));
}

async function getAdminDashboardMetrics() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
  const lastDay = new Date();
  lastDay.setUTCDate(lastDay.getUTCDate() - 1);

  const [users, teams, checkins, recentUsers, recentTeams, recentCheckins] = await Promise.all([
    db.queryMany("users", { projection: ["plan"] }),
    db.queryMany("teams", { projection: ["id"] }),
    db.queryMany("checkins", { projection: ["id"] }),
    db.count("users", {
      filter: {
        created_at: {
          $gte: db.now(thirtyDaysAgo),
        },
      },
    }),
    db.count("teams", {
      filter: {
        created_at: {
          $gte: db.now(thirtyDaysAgo),
        },
      },
    }),
    db.count("checkins", {
      filter: {
        timestamp: {
          $gte: db.now(lastDay),
        },
      },
    }),
  ]);

  const planCounts = new Map();

  users.forEach((user) => {
    const plan = user.plan || "free";
    planCounts.set(plan, (planCounts.get(plan) || 0) + 1);
  });

  const planBreakdown = [...planCounts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([plan, userCount]) => ({
      plan,
      user_count: userCount,
    }));

  return {
    overview: {
      totalUsers: users.length,
      newUsers30d: recentUsers,
      totalTeams: teams.length,
      activeTeams30d: recentTeams,
      checkinsLast24h: recentCheckins,
    },
    planBreakdown,
    checkinsPerDay: await getCheckinsPerDay(),
  };
}

module.exports = {
  getAdminDashboardMetrics,
};
