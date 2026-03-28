const express = require("express");
const { adminApiKey } = require("../config");
const { getAdminDashboardMetrics } = require("../services/analyticsService");

const router = express.Router();

router.get("/dashboard", async (req, res, next) => {
  const providedKey = String(req.headers["x-admin-key"] || "").trim();

  if (!adminApiKey || providedKey !== adminApiKey) {
    return res.status(401).json({ error: "Admin access denied" });
  }

  try {
    return res.json(await getAdminDashboardMetrics());
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
