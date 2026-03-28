const express = require("express");
const { requireAuth } = require("../middleware/auth");
const {
  validateCreateTeam,
  validateJoinTeam,
  validateCheckin,
  validateTeamDataQuery,
  validateInviteMember,
} = require("../middleware/validation");
const { asyncHandler } = require("../utils/asyncHandler");
const {
  createTeamForUser,
  joinTeamForUser,
  createCheckinForUser,
  getTeamDataForUser,
  inviteMemberForTeam,
} = require("../services/teamService");

const router = express.Router();

router.use(requireAuth);

router.post(
  "/create-team",
  validateCreateTeam,
  asyncHandler(async (req, res) => {
    const { name } = req.validated;
    return res.status(201).json(await createTeamForUser(req.user.id, name));
  })
);

router.post(
  "/join-team",
  validateJoinTeam,
  asyncHandler(async (req, res) => {
    const { inviteCode } = req.validated;
    return res.json(await joinTeamForUser(req.user.id, inviteCode));
  })
);

router.post(
  "/checkin",
  validateCheckin,
  asyncHandler(async (req, res) => {
    const { teamId, moodScore, note } = req.validated;
    return res.status(201).json(await createCheckinForUser(req.user.id, teamId, moodScore, note));
  })
);

router.get(
  "/team-data",
  validateTeamDataQuery,
  asyncHandler(async (req, res) => {
    const { teamId } = req.validated;

    return res.json(await getTeamDataForUser(req.user.id, teamId));
  })
);

router.post(
  "/invite-member",
  validateInviteMember,
  asyncHandler(async (req, res) => {
    const { teamId, inviteEmail } = req.validated;
    return res.json(await inviteMemberForTeam(req.user.id, teamId, inviteEmail));
  })
);

module.exports = router;
