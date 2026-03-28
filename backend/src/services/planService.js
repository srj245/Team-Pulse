const db = require("../db");

const PLAN_DEFINITIONS = {
  free: {
    id: "free",
    name: "Free",
    limits: {
      maxTeams: 1,
      maxMembersPerTeam: 5,
    },
    features: {
      advancedAnalytics: false,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    limits: {
      maxTeams: null,
      maxMembersPerTeam: null,
    },
    features: {
      advancedAnalytics: true,
    },
  },
};

function normalizePlan(plan) {
  return PLAN_DEFINITIONS[plan] ? plan : "free";
}

function getPlanDefinition(plan) {
  return PLAN_DEFINITIONS[normalizePlan(plan)];
}

async function getUserPlanRecord(userId, client = db) {
  const user = await client.queryOne("users", {
    filter: { id: userId },
    projection: ["id", "email", "plan", "billing_status", "onboarding_completed", "stripe_customer_id"],
  });

  if (!user) {
    const error = new Error("User not found");
    error.status = 404;
    throw error;
  }

  return user;
}

async function getTeamCountForUser(userId, client = db) {
  return client.count("memberships", {
    filter: { user_id: userId },
  });
}

async function getMemberCountForTeam(teamId, client = db) {
  return client.count("memberships", {
    filter: { team_id: teamId },
  });
}

async function getUsageForUser(userId, client = db) {
  const user = await getUserPlanRecord(userId, client);
  const definition = getPlanDefinition(user.plan);

  return {
    plan: definition.id,
    billingStatus: user.billing_status,
    onboardingCompleted: Boolean(user.onboarding_completed),
    features: definition.features,
    usage: {
      teamCount: await getTeamCountForUser(userId, client),
      maxTeams: definition.limits.maxTeams,
    },
  };
}

async function assertCanCreateTeam(userId, client = db) {
  const user = await getUserPlanRecord(userId, client);
  const definition = getPlanDefinition(user.plan);
  const teamCount = await getTeamCountForUser(userId, client);

  if (definition.limits.maxTeams != null && teamCount >= definition.limits.maxTeams) {
    const error = new Error(
      "Free plan includes 1 team. Upgrade to Pro to create more workspaces."
    );
    error.status = 402;
    error.code = "PLAN_LIMIT_TEAMS";
    error.details = {
      plan: definition.id,
      usage: {
        teamCount,
        maxTeams: definition.limits.maxTeams,
      },
    };
    throw error;
  }
}

async function assertCanAddMember(teamId, client = db) {
  const team = await client.queryOne("teams", {
    filter: { id: teamId },
    projection: ["id", "name", "created_by"],
  });

  if (!team) {
    const error = new Error("Team not found");
    error.status = 404;
    throw error;
  }

  const owner = await client.queryOne("users", {
    filter: { id: team.created_by },
    projection: ["plan"],
  });

  if (!owner) {
    const error = new Error("Team owner not found");
    error.status = 404;
    throw error;
  }

  const definition = getPlanDefinition(owner.plan);
  const memberCount = await getMemberCountForTeam(teamId, client);

  if (
    definition.limits.maxMembersPerTeam != null &&
    memberCount >= definition.limits.maxMembersPerTeam
  ) {
    const error = new Error(
      "Free plan supports up to 5 members per team. Upgrade to Pro to invite more people."
    );
    error.status = 402;
    error.code = "PLAN_LIMIT_MEMBERS";
    error.details = {
      plan: definition.id,
      teamId,
      usage: {
        memberCount,
        maxMembersPerTeam: definition.limits.maxMembersPerTeam,
      },
    };
    throw error;
  }
}

async function setUserPlan(userId, plan, billingStatus = "active", client = db) {
  const normalizedPlan = normalizePlan(plan);

  await client.update("users", {
    filter: { id: userId },
    set: {
      plan: normalizedPlan,
      billing_status: billingStatus,
      updated_at: client.now(),
    },
  });

  return getUsageForUser(userId, client);
}

module.exports = {
  PLAN_DEFINITIONS,
  getPlanDefinition,
  getUsageForUser,
  getUserPlanRecord,
  getTeamCountForUser,
  getMemberCountForTeam,
  assertCanCreateTeam,
  assertCanAddMember,
  setUserPlan,
};
