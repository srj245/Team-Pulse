const db = require("../db");
const { generateInviteCode } = require("../utils/inviteCode");
const {
  assertCanCreateTeam,
  assertCanAddMember,
  getPlanDefinition,
  getUsageForUser,
} = require("./planService");
const { sendInviteEmail } = require("./emailService");

function serializeTeamSummary(team, viewerUserId) {
  const isManager = Number(team.created_by) === Number(viewerUserId);
  const response = {
    id: team.id,
    name: team.name,
    createdAt: team.created_at,
    isManager,
    ownerPlan: team.owner_plan || "free",
  };

  if (isManager) {
    response.inviteCode = team.invite_code;
    response.createdBy = team.created_by;
  }

  return response;
}

function serializeTeamDataTeam(team, viewerUserId) {
  return serializeTeamSummary(team, viewerUserId);
}

function serializeMemberForViewer(member, viewerUserId, isManager) {
  if (!isManager && Number(member.id) !== Number(viewerUserId)) {
    return null;
  }

  return {
    id: member.id,
    ...(isManager ? { email: member.email } : {}),
    joinedAt: member.joinedAt,
    burnoutRisk: member.burnoutRisk,
  };
}

function serializeCheckinForViewer(checkin, viewerUserId, isManager) {
  if (!isManager && Number(checkin.userId) !== Number(viewerUserId)) {
    return null;
  }

  return {
    id: checkin.id,
    userId: checkin.userId,
    ...(isManager ? { userEmail: checkin.userEmail } : {}),
    teamId: checkin.teamId,
    moodScore: checkin.moodScore,
    note: checkin.note,
    timestamp: checkin.timestamp,
  };
}

function mapBy(rows, field) {
  return new Map(rows.map((row) => [row[field], row]));
}

async function getUserTeams(userId, client = db) {
  const memberships = await client.queryMany("memberships", {
    filter: { user_id: userId },
    sort: { created_at: 1 },
    projection: ["team_id"],
  });

  if (!memberships.length) {
    return [];
  }

  const teamIds = memberships.map((membership) => membership.team_id);
  const teams = await client.queryMany("teams", {
    filter: { id: { $in: teamIds } },
    projection: ["id", "name", "invite_code", "created_by", "created_at"],
  });
  const owners = await client.queryMany("users", {
    filter: { id: { $in: [...new Set(teams.map((team) => team.created_by))] } },
    projection: ["id", "plan"],
  });
  const teamsById = mapBy(teams, "id");
  const ownersById = mapBy(owners, "id");

  return teamIds
    .map((teamId) => {
      const team = teamsById.get(teamId);

      if (!team) {
        return null;
      }

      return serializeTeamSummary(
        {
          ...team,
          owner_plan: ownersById.get(team.created_by)?.plan || "free",
        },
        userId
      );
    })
    .filter(Boolean);
}

async function requireMembership(userId, teamId, client = db) {
  const membership = await client.queryOne("memberships", {
    filter: { user_id: userId, team_id: teamId },
    projection: ["user_id", "team_id"],
  });

  if (!membership) {
    const error = new Error("You are not a member of this team");
    error.status = 403;
    throw error;
  }
}

async function runInTransaction(operation) {
  return db.transaction(operation);
}

function getLastSevenDates() {
  const dates = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - offset);
    dates.push(date.toISOString().slice(0, 10));
  }

  return dates;
}

function getUtcDayRange(daysBack = 6) {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  end.setUTCDate(end.getUTCDate() + 1);

  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - (daysBack + 1));

  return {
    start: start.toISOString().slice(0, 19).replace("T", " "),
    end: end.toISOString().slice(0, 19).replace("T", " "),
  };
}

async function buildWeeklyMoodSeries(teamId, client = db) {
  const dateKeys = getLastSevenDates();
  const range = getUtcDayRange(6);
  const rows = await client.queryMany("checkins", {
    filter: {
      team_id: teamId,
      timestamp: {
        $gte: range.start,
        $lt: range.end,
      },
    },
    projection: ["timestamp", "mood_score"],
    sort: { timestamp: 1 },
  });
  const byDay = new Map();

  rows.forEach((row) => {
    const day = String(row.timestamp).slice(0, 10);
    const current = byDay.get(day) || {
      totalMood: 0,
      count: 0,
    };
    current.totalMood += Number(row.mood_score);
    current.count += 1;
    byDay.set(day, current);
  });

  return dateKeys.map((date) => {
    const day = byDay.get(date);

    if (!day) {
      return {
        date,
        averageMood: null,
        checkinCount: 0,
      };
    }

    return {
      date,
      averageMood: Number((day.totalMood / day.count).toFixed(2)),
      checkinCount: day.count,
    };
  });
}

async function getMemberWeeklySummaries(teamId, client = db) {
  const range = getUtcDayRange(6);
  const rows = await client.queryMany("checkins", {
    filter: {
      team_id: teamId,
      timestamp: {
        $gte: range.start,
        $lt: range.end,
      },
    },
    projection: ["user_id", "timestamp", "mood_score"],
    sort: { user_id: 1, timestamp: 1 },
  });
  const summaries = new Map();

  rows.forEach((row) => {
    const userId = row.user_id;
    const day = String(row.timestamp).slice(0, 10);

    if (!summaries.has(userId)) {
      summaries.set(userId, {
        checkinDays: 0,
        totalCheckins: 0,
        dailyMoodSeries: [],
        lastCheckinAt: null,
      });
    }

    const summary = summaries.get(userId);
    let daily = summary.dailyMoodSeries.find((entry) => entry.date === day);

    if (!daily) {
      daily = {
        date: day,
        totalMood: 0,
        checkinCount: 0,
      };
      summary.dailyMoodSeries.push(daily);
      summary.checkinDays += 1;
    }

    daily.totalMood += Number(row.mood_score);
    daily.checkinCount += 1;
    summary.totalCheckins += 1;

    if (!summary.lastCheckinAt || row.timestamp > summary.lastCheckinAt) {
      summary.lastCheckinAt = row.timestamp;
    }
  });

  summaries.forEach((summary) => {
    summary.dailyMoodSeries = summary.dailyMoodSeries.map((day) => ({
      date: day.date,
      averageMood: Number((day.totalMood / day.checkinCount).toFixed(2)),
      checkinCount: day.checkinCount,
    }));
  });

  return summaries;
}

function daysSinceTimestamp(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const currentDate = new Date();
  currentDate.setUTCHours(0, 0, 0, 0);

  const targetDate = new Date(parsed);
  targetDate.setUTCHours(0, 0, 0, 0);

  return Math.max(
    0,
    Math.floor((currentDate.getTime() - targetDate.getTime()) / (24 * 60 * 60 * 1000))
  );
}

function calculateTrend(weeklyMood) {
  const populated = weeklyMood.filter((day) => day.averageMood != null);

  if (populated.length < 2) {
    return {
      direction: "stable",
      label: "Not enough data",
      delta: 0,
    };
  }

  const midpoint = Math.ceil(populated.length / 2);
  const firstHalf = populated.slice(0, midpoint);
  const secondHalf = populated.slice(midpoint);

  const average = (items) =>
    items.reduce((sum, item) => sum + item.averageMood, 0) / items.length;

  const baseline = average(firstHalf);
  const recent = average(secondHalf.length ? secondHalf : firstHalf.slice(-1));
  const delta = Number((recent - baseline).toFixed(2));

  if (delta >= 0.2) {
    return {
      direction: "improving",
      label: "Improving",
      delta,
    };
  }

  if (delta <= -0.2) {
    return {
      direction: "declining",
      label: "Declining",
      delta,
    };
  }

  return {
    direction: "stable",
    label: "Stable",
    delta,
  };
}

async function getRecentUserCheckins(teamId, client = db) {
  const grouped = new Map();
  const rows = await client.queryMany("checkins", {
    filter: { team_id: teamId },
    projection: ["user_id", "mood_score", "timestamp"],
    sort: { user_id: 1, timestamp: -1 },
  });

  rows.forEach((row) => {
    if (!grouped.has(row.user_id)) {
      grouped.set(row.user_id, []);
    }

    const entries = grouped.get(row.user_id);

    if (entries.length < 5) {
      entries.push({
        moodScore: row.mood_score,
        timestamp: row.timestamp,
      });
    }
  });

  const memberships = await client.queryMany("memberships", {
    filter: { team_id: teamId },
    projection: ["user_id"],
    sort: { user_id: 1 },
  });

  memberships.forEach((member) => {
    if (!grouped.has(member.user_id)) {
      grouped.set(member.user_id, []);
    }
  });

  return grouped;
}

function calculateBurnoutRisk(recentCheckins, weeklySummary) {
  const chronological = recentCheckins ? [...recentCheckins].reverse() : [];
  const dailyMoodSeries = weeklySummary?.dailyMoodSeries || [];
  const checkinDays = weeklySummary?.checkinDays || 0;
  const totalCheckins = weeklySummary?.totalCheckins || chronological.length;
  const lastCheckinAt = weeklySummary?.lastCheckinAt || null;
  const missingDays = Math.max(0, 7 - checkinDays);
  const averageMoodSource =
    dailyMoodSeries.length > 0
      ? dailyMoodSeries.map((day) => day.averageMood).filter((value) => value != null)
      : chronological.map((checkin) => checkin.moodScore);
  const averageMood =
    averageMoodSource.length > 0
      ? Number(
          (
            averageMoodSource.reduce((sum, value) => sum + value, 0) / averageMoodSource.length
          ).toFixed(2)
        )
      : null;
  const firstMood = chronological.length > 0 ? chronological[0].moodScore : null;
  const lastMood = chronological.length > 0 ? chronological[chronological.length - 1].moodScore : null;
  const moodDelta =
    firstMood != null && lastMood != null ? Number((lastMood - firstMood).toFixed(2)) : null;
  const moodRange =
    chronological.length > 0
      ? Math.max(...chronological.map((checkin) => checkin.moodScore)) -
        Math.min(...chronological.map((checkin) => checkin.moodScore))
      : 0;
  const daysSinceLastCheckin = daysSinceTimestamp(lastCheckinAt);
  const signals = [];
  let score = 0;

  if (averageMood == null) {
    return {
      risk_level: "low",
      score: 5,
      reason: "No recent check-in history yet",
      averageMood: null,
      checkinDays,
      totalCheckins,
      missingDays,
      lastCheckinAt,
      daysSinceLastCheckin,
      signals: ["No recent check-in history yet"],
    };
  }

  if (averageMood <= 2.2) {
    score += 45;
    signals.push(`Average mood is critically low at ${averageMood.toFixed(2)}`);
  } else if (averageMood <= 2.8) {
    score += 30;
    signals.push(`Average mood is low at ${averageMood.toFixed(2)}`);
  } else if (averageMood <= 3.4) {
    score += 12;
    signals.push(`Average mood is soft at ${averageMood.toFixed(2)}`);
  }

  if (moodDelta != null && moodDelta <= -2) {
    score += 20;
    signals.push(`Mood dropped ${Math.abs(moodDelta).toFixed(0)} points across recent check-ins`);
  } else if (moodDelta != null && moodDelta <= -1) {
    score += 12;
    signals.push("Mood is trending down");
  }

  if (
    chronological.length >= 2 &&
    chronological[chronological.length - 1].moodScore <= 2 &&
    chronological[chronological.length - 2].moodScore <= 2
  ) {
    score += 18;
    signals.push("Two consecutive low mood check-ins were recorded");
  }

  if (moodRange >= 2) {
    score += 8;
    signals.push("Mood has been unstable across recent check-ins");
  }

  if (missingDays >= 4) {
    score += 20;
    signals.push(`Only ${checkinDays} of the last 7 days have check-ins`);
  } else if (missingDays >= 2) {
    score += 10;
    signals.push(`${missingDays} recent check-in days are missing`);
  }

  if (daysSinceLastCheckin != null && daysSinceLastCheckin >= 3) {
    score += 15;
    signals.push(`Last check-in was ${daysSinceLastCheckin} days ago`);
  }

  score = Math.min(100, score);

  let riskLevel = "low";

  if (score >= 60) {
    riskLevel = "high";
  } else if (score >= 30) {
    riskLevel = "medium";
  }

  return {
    risk_level: riskLevel,
    score,
    reason: signals.slice(0, 2).join(". ") || "Mood has remained stable across recent check-ins",
    averageMood,
    checkinDays,
    totalCheckins,
    missingDays,
    lastCheckinAt,
    daysSinceLastCheckin,
    signals: signals.length > 0 ? signals : ["Mood has remained stable across recent check-ins"],
  };
}

function calculateRecentAverage(recentCheckins) {
  if (!recentCheckins || recentCheckins.length === 0) {
    return null;
  }

  const average =
    recentCheckins.reduce((sum, checkin) => sum + checkin.moodScore, 0) / recentCheckins.length;

  return Number(average.toFixed(2));
}

function buildAlertMessage(memberEmail, burnoutRisk) {
  return `Simulated Slack alert: ${memberEmail} is at ${burnoutRisk.score}/100 risk. ${burnoutRisk.reason}.`;
}

async function syncBurnoutAlerts(teamId, membersWithRisk, client = db) {
  const activeAlerts = await client.queryMany("alerts", {
    filter: {
      team_id: teamId,
      status: "active",
    },
    projection: ["id", "user_id", "status"],
  });
  const activeByUser = new Map(activeAlerts.map((alert) => [alert.user_id, alert]));
  const alertsToReturn = [];

  for (const member of membersWithRisk) {
    const existing = activeByUser.get(member.id);

    if (member.burnoutRisk.risk_level === "high") {
      const notificationMessage = buildAlertMessage(member.email, member.burnoutRisk);

      if (existing) {
        await client.update("alerts", {
          filter: { id: existing.id },
          set: {
            risk_level: member.burnoutRisk.risk_level,
            reason: member.burnoutRisk.reason,
            notification_message: notificationMessage,
            updated_at: client.now(),
          },
        });
        alertsToReturn.push({
          id: existing.id,
          userId: member.id,
          userEmail: member.email,
          riskLevel: member.burnoutRisk.risk_level,
          score: member.burnoutRisk.score,
          reason: member.burnoutRisk.reason,
          notificationChannel: "slack_simulated",
          notificationMessage,
          status: "active",
        });
      } else {
        const result = await client.insert(
          "alerts",
          {
            user_id: member.id,
            team_id: teamId,
            risk_level: member.burnoutRisk.risk_level,
            reason: member.burnoutRisk.reason,
            notification_channel: "slack_simulated",
            notification_message: notificationMessage,
            status: "active",
            created_at: client.now(),
            updated_at: client.now(),
          },
          { autoId: true }
        );
        console.log(notificationMessage);
        alertsToReturn.push({
          id: result.insertedId,
          userId: member.id,
          userEmail: member.email,
          riskLevel: member.burnoutRisk.risk_level,
          score: member.burnoutRisk.score,
          reason: member.burnoutRisk.reason,
          notificationChannel: "slack_simulated",
          notificationMessage,
          status: "active",
        });
      }

      activeByUser.delete(member.id);
      continue;
    }

    if (existing) {
      await client.update("alerts", {
        filter: { id: existing.id },
        set: {
          status: "resolved",
          updated_at: client.now(),
        },
      });
      activeByUser.delete(member.id);
    }
  }

  for (const alert of activeByUser.values()) {
    await client.update("alerts", {
      filter: { id: alert.id },
      set: {
        status: "resolved",
        updated_at: client.now(),
      },
    });
  }

  return alertsToReturn;
}

function buildRecoverySprint(team, members, alerts, weeklyMood, teamStats, recentUserCheckins) {
  const highRiskMembers = members.filter((member) => member.burnoutRisk.risk_level === "high");
  const mediumRiskMembers = members.filter((member) => member.burnoutRisk.risk_level === "medium");
  const silentMembers = members.filter((member) => member.burnoutRisk.missingDays >= 3);
  const lowRiskCandidates = members
    .filter((member) => member.burnoutRisk.risk_level === "low")
    .map((member) => ({
      email: member.email,
      averageMood: calculateRecentAverage(recentUserCheckins.get(member.id)),
    }))
    .filter((member) => member.averageMood != null)
    .sort((left, right) => right.averageMood - left.averageMood);

  const supportBuddy = lowRiskCandidates[0] || null;
  const activeDays = weeklyMood.filter((day) => day.checkinCount > 0).length;

  if (highRiskMembers.length > 0) {
    const names = highRiskMembers.map((member) => member.email).join(", ");

    return {
      title: "Recovery Sprint",
      severity: "critical",
      summary: `${highRiskMembers.length} employee${highRiskMembers.length === 1 ? "" : "s"} flagged high risk in ${team.name}.`,
      whyItMatters: `Average team mood is ${teamStats.weeklyAverageMood ?? "unavailable"}, ${alerts.length} active alert${alerts.length === 1 ? "" : "s"} are open, and ${silentMembers.length} member${silentMembers.length === 1 ? "" : "s"} missed at least 3 check-in days.`,
      actions: [
        `Reach out privately to ${names} within the next 2 hours.`,
        supportBuddy
          ? `Pair ${supportBuddy.email} as a support buddy for a same-day async check-in.`
          : "Assign a peer support buddy for a same-day async check-in.",
        "Reduce meeting load or shift one task off the at-risk employee for the next 24 hours.",
      ],
    };
  }

  if (teamStats.trend.direction === "declining") {
    return {
      title: "Preventive Sprint",
      severity: "warning",
      summary: `Team mood is declining in ${team.name} even though no one is high risk yet.`,
      whyItMatters: `${activeDays} of the last 7 days have check-ins, ${mediumRiskMembers.length} member${mediumRiskMembers.length === 1 ? "" : "s"} are medium risk, and the team dropped ${Math.abs(teamStats.trend.delta).toFixed(2)} points.`,
      actions: [
        "Post a quick async pulse asking what is blocking momentum today.",
        "Cancel one low-value sync and give the team a focused recovery block.",
        silentMembers.length > 0
          ? `Check in with ${silentMembers.map((member) => member.email).join(", ")} about missing updates.`
          : "Recognize one concrete win publicly before end of day to reset tone.",
      ],
    };
  }

  return {
    title: "Momentum Sprint",
    severity: "healthy",
    summary: `${team.name} is stable right now.`,
    whyItMatters: `No active high-risk alerts and the current team trend is ${teamStats.trend.label.toLowerCase()}.`,
    actions: [
      "Keep daily check-ins consistent for the next week.",
      "Celebrate one visible team win to reinforce momentum.",
      silentMembers.length > 0
        ? `Nudge ${silentMembers.map((member) => member.email).join(", ")} to restart daily check-ins before visibility drops.`
        : "Watch for members with missing check-ins before the trend turns.",
    ],
  };
}

async function createTeamForUser(userId, name) {
  await assertCanCreateTeam(userId);

  const team = await runInTransaction(async (client) => {
    await assertCanCreateTeam(userId, client);

    let inviteCode = generateInviteCode();

    while (
      await client.queryOne("teams", {
        filter: { invite_code: inviteCode },
        projection: ["id"],
      })
    ) {
      inviteCode = generateInviteCode();
    }

    const teamInsert = await client.insert(
      "teams",
      {
        name,
        invite_code: inviteCode,
        created_by: userId,
        created_at: client.now(),
        updated_at: client.now(),
      },
      { autoId: true }
    );

    await client.insert(
      "memberships",
      {
        user_id: userId,
        team_id: teamInsert.insertedId,
        created_at: client.now(),
      },
      { autoId: true }
    );

    return client.queryOne("teams", {
      filter: { id: teamInsert.insertedId },
      projection: ["id", "name", "invite_code", "created_by", "created_at"],
    });
  });

  return {
    team: {
      id: team.id,
      name: team.name,
      inviteCode: team.invite_code,
      createdBy: team.created_by,
      createdAt: team.created_at,
    },
    planAccess: await getUsageForUser(userId),
  };
}

async function joinTeamForUser(userId, inviteCode) {
  const team = await db.queryOne("teams", {
    filter: { invite_code: inviteCode },
    projection: ["id", "name", "invite_code", "created_at"],
  });

  if (!team) {
    const error = new Error("Team not found");
    error.status = 404;
    throw error;
  }

  const membershipExists = await db.queryOne("memberships", {
    filter: { user_id: userId, team_id: team.id },
    projection: ["id"],
  });

  if (membershipExists) {
    const error = new Error("You already belong to this team");
    error.status = 409;
    throw error;
  }

  await assertCanAddMember(team.id);

  await db.insert(
    "memberships",
    {
      user_id: userId,
      team_id: team.id,
      created_at: db.now(),
    },
    { autoId: true }
  );

  return {
    team: {
      id: team.id,
      name: team.name,
      inviteCode: team.invite_code,
      createdAt: team.created_at,
    },
    planAccess: await getUsageForUser(userId),
  };
}

async function createCheckinForUser(userId, teamId, moodScore, note) {
  const todayRange = getUtcDayRange(0);

  await requireMembership(userId, teamId);

  const existingCheckin = await db.queryOne("checkins", {
    filter: {
      team_id: teamId,
      user_id: userId,
      timestamp: {
        $gte: todayRange.start,
        $lt: todayRange.end,
      },
    },
    projection: ["id"],
  });

  if (existingCheckin) {
    const error = new Error("You have already submitted a check-in for today");
    error.status = 409;
    throw error;
  }

  const result = await db.insert(
    "checkins",
    {
      user_id: userId,
      team_id: teamId,
      mood_score: moodScore,
      note,
      timestamp: db.now(),
    },
    { autoId: true }
  );
  const checkin = await db.queryOne("checkins", {
    filter: { id: result.insertedId },
    projection: ["id", "user_id", "team_id", "mood_score", "note", "timestamp"],
  });

  return {
    checkin: {
      id: checkin.id,
      userId: checkin.user_id,
      teamId: checkin.team_id,
      moodScore: checkin.mood_score,
      note: checkin.note,
      timestamp: checkin.timestamp,
    },
  };
}

async function getTeamDataForUser(userId, teamId) {
  await requireMembership(userId, teamId);

  const team = await db.queryOne("teams", {
    filter: { id: teamId },
    projection: ["id", "name", "invite_code", "created_by", "created_at"],
  });

  if (!team) {
    const error = new Error("Team not found");
    error.status = 404;
    throw error;
  }

  const owner = await db.queryOne("users", {
    filter: { id: team.created_by },
    projection: ["id", "plan"],
  });
  const viewerUsage = await getUsageForUser(userId);
  const teamPlan = getPlanDefinition(owner?.plan);
  const hasAdvancedAnalytics = teamPlan.features.advancedAnalytics;
  const [recentUserCheckins, memberWeeklySummaries, memberships, checkinRows] = await Promise.all([
    getRecentUserCheckins(teamId),
    getMemberWeeklySummaries(teamId),
    db.queryMany("memberships", {
      filter: { team_id: teamId },
      projection: ["user_id", "created_at"],
      sort: { created_at: 1 },
    }),
    db.queryMany("checkins", {
      filter: { team_id: teamId },
      projection: ["id", "user_id", "team_id", "mood_score", "note", "timestamp"],
      sort: { timestamp: -1 },
      limit: 100,
    }),
  ]);
  const users = await db.queryMany("users", {
    filter: { id: { $in: memberships.map((membership) => membership.user_id) } },
    projection: ["id", "email"],
  });
  const usersById = mapBy(users, "id");
  const members = memberships.map((membership) => {
    const user = usersById.get(membership.user_id);
    const burnoutRisk = calculateBurnoutRisk(
      recentUserCheckins.get(membership.user_id),
      memberWeeklySummaries.get(membership.user_id)
    );

    return {
      id: membership.user_id,
      email: user?.email,
      joinedAt: membership.created_at,
      burnoutRisk: hasAdvancedAnalytics
        ? burnoutRisk
        : {
            risk_level: "locked",
            score: null,
            reason: "Upgrade to Pro to unlock risk scoring and advanced analytics.",
            checkinDays: burnoutRisk.checkinDays,
          },
    };
  });

  const alerts = hasAdvancedAnalytics ? await syncBurnoutAlerts(teamId, members) : [];
  const checkins = checkinRows.map((checkin) => ({
    id: checkin.id,
    userId: checkin.user_id,
    userEmail: usersById.get(checkin.user_id)?.email,
    teamId: checkin.team_id,
    moodScore: checkin.mood_score,
    note: checkin.note,
    timestamp: checkin.timestamp,
  }));

  const stats = checkinRows.reduce(
    (result, row) => {
      result.total_checkins += 1;
      result.total_mood += Number(row.mood_score);

      if (!result.last_checkin_at || row.timestamp > result.last_checkin_at) {
        result.last_checkin_at = row.timestamp;
      }

      return result;
    },
    {
      total_checkins: 0,
      total_mood: 0,
      last_checkin_at: null,
    }
  );
  const weeklyMood = hasAdvancedAnalytics ? await buildWeeklyMoodSeries(teamId) : [];
  const trend = hasAdvancedAnalytics
    ? calculateTrend(weeklyMood)
    : {
        direction: "locked",
        label: "Pro feature",
        delta: 0,
      };
  const populatedDays = weeklyMood.filter((day) => day.averageMood != null);
  const weeklyAverageMood =
    populatedDays.length === 0
      ? null
      : Number(
          (
            populatedDays.reduce((sum, day) => sum + day.averageMood, 0) / populatedDays.length
          ).toFixed(2)
        );

  const teamStats = {
    totalCheckins: stats.total_checkins,
    averageMood:
      stats.total_checkins === 0 ? null : Number((stats.total_mood / stats.total_checkins).toFixed(2)),
    lastCheckinAt: stats.last_checkin_at,
    weeklyAverageMood,
    trend,
  };
  const recoverySprint = hasAdvancedAnalytics
    ? buildRecoverySprint(
        {
          id: team.id,
          name: team.name,
        },
        members,
        alerts,
        weeklyMood,
        teamStats,
        recentUserCheckins
      )
    : null;

  const isManager = Number(team.created_by) === Number(userId);
  const memberCount = memberships.length;

  return {
    team: serializeTeamDataTeam(
      {
        ...team,
        owner_plan: owner?.plan || "free",
      },
      userId
    ),
    members: members
      .map((member) => serializeMemberForViewer(member, userId, isManager))
      .filter(Boolean),
    alerts: isManager ? alerts : [],
    recoverySprint: isManager ? recoverySprint : null,
    stats: teamStats,
    weeklyMood,
    checkins: checkins
      .map((checkin) => serializeCheckinForViewer(checkin, userId, isManager))
      .filter(Boolean),
    planAccess: viewerUsage,
    upgradePrompt: hasAdvancedAnalytics
      ? null
      : {
          title: "Unlock Pro analytics",
          message:
            "Burnout risk scores, 7-day mood trends, and recovery playbooks are available on the Pro plan.",
        },
    limits: {
      teamMemberCount: memberCount,
      maxMembersPerTeam: teamPlan.limits.maxMembersPerTeam,
      advancedAnalytics: hasAdvancedAnalytics,
    },
  };
}

async function inviteMemberForTeam(userId, teamId, inviteEmail) {
  await requireMembership(userId, teamId);
  const team = await db.queryOne("teams", {
    filter: { id: teamId },
    projection: ["id", "name", "invite_code", "created_by"],
  });

  if (!team) {
    const error = new Error("Team not found");
    error.status = 404;
    throw error;
  }

  const inviter = await db.queryOne("users", {
    filter: { id: team.created_by },
    projection: ["email"],
  });

  if (Number(team.created_by) !== Number(userId)) {
    const error = new Error("Only the team owner can send invite emails");
    error.status = 403;
    throw error;
  }

  await assertCanAddMember(teamId);

  await db.insert(
    "invitations",
    {
      team_id: teamId,
      invited_by_user_id: userId,
      invite_email: inviteEmail,
      invite_code: team.invite_code,
      created_at: db.now(),
    },
    { autoId: true }
  );

  sendInviteEmail({
    to: inviteEmail,
    inviterEmail: inviter?.email,
    teamName: team.name,
    inviteCode: team.invite_code,
  }).catch((error) => {
    console.error(`Failed to send invite email to ${inviteEmail}`, error);
  });

  return {
    success: true,
    message: `Invite sent to ${inviteEmail}.`,
  };
}

module.exports = {
  getUserTeams,
  createTeamForUser,
  joinTeamForUser,
  createCheckinForUser,
  getTeamDataForUser,
  inviteMemberForTeam,
};
