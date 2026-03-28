const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { asyncHandler } = require("../utils/asyncHandler");
const {
  createCheckoutSessionForUser,
  handleStripeWebhook,
  getBillingPortalState,
} = require("../services/billingService");
const { getUserPlanRecord } = require("../services/planService");

const router = express.Router();

router.get(
  "/billing-state",
  requireAuth,
  asyncHandler(async (req, res) => {
    return res.json(await getBillingPortalState(req.user.id));
  })
);

router.post(
  "/create-checkout-session",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await getUserPlanRecord(req.user.id);
    return res.json(await createCheckoutSessionForUser(user));
  })
);

router.post(
  "/webhook",
  asyncHandler(async (req, res) => {
    const signature = req.headers["stripe-signature"];
    const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
    const event = await handleStripeWebhook(signature, rawBody);
    return res.json({ received: true, type: event.type });
  })
);

module.exports = router;
