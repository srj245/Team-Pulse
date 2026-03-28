const Stripe = require("stripe");
const db = require("../db");
const {
  stripeSecretKey,
  stripeWebhookSecret,
  stripePriceIdProMonthly,
  frontendUrl,
} = require("../config");
const { setUserPlan, getUserPlanRecord } = require("./planService");

let cachedStripe;

function getStripeClient() {
  if (!stripeSecretKey) {
    return null;
  }

  if (!cachedStripe) {
    cachedStripe = new Stripe(stripeSecretKey);
  }

  return cachedStripe;
}

function ensureBillingConfigured() {
  if (!stripeSecretKey || !stripePriceIdProMonthly) {
    const error = new Error(
      "Billing is not configured yet. Add Stripe keys and the Pro price ID in the backend environment."
    );
    error.status = 503;
    throw error;
  }
}

async function ensureCustomer(user) {
  const stripe = getStripeClient();

  if (!stripe) {
    ensureBillingConfigured();
  }

  if (user.stripe_customer_id) {
    return user.stripe_customer_id;
  }

  const customer = await stripe.customers.create({
    email: user.email,
    metadata: {
      userId: String(user.id),
    },
  });

  await db.update("users", {
    filter: { id: user.id },
    set: {
      stripe_customer_id: customer.id,
      updated_at: db.now(),
    },
  });

  return customer.id;
}

async function createCheckoutSessionForUser(user) {
  ensureBillingConfigured();
  const stripe = getStripeClient();
  const customerId = await ensureCustomer(user);
  const baseUrl = (frontendUrl || "").replace(/\/$/, "");
  const successUrl = `${baseUrl}/dashboard?billing=success`;
  const cancelUrl = `${baseUrl}/dashboard?billing=cancelled`;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [
      {
        price: stripePriceIdProMonthly,
        quantity: 1,
      },
    ],
    allow_promotion_codes: true,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId: String(user.id),
      plan: "pro",
    },
  });

  await db.insert(
    "billing_events",
    {
      user_id: user.id,
      event_type: "checkout.session.created",
      session_id: session.id,
      payment_status: session.payment_status || "unpaid",
      raw_payload: JSON.stringify(session),
      created_at: db.now(),
    },
    { autoId: true }
  );

  return {
    checkoutUrl: session.url,
    sessionId: session.id,
  };
}

async function upgradeUserToPro(userId, eventType, payload) {
  await setUserPlan(userId, "pro", "active");
  await db.insert(
    "billing_events",
    {
      user_id: userId,
      event_type: eventType,
      session_id: payload.id || null,
      payment_status: payload.payment_status || payload.status || "paid",
      raw_payload: JSON.stringify(payload),
      created_at: db.now(),
    },
    { autoId: true }
  );
}

async function handleStripeWebhook(signature, rawBody) {
  ensureBillingConfigured();
  const stripe = getStripeClient();
  let event;

  if (stripeWebhookSecret) {
    event = stripe.webhooks.constructEvent(rawBody, signature, stripeWebhookSecret);
  } else {
    event = JSON.parse(rawBody.toString("utf8"));
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = Number(session.metadata?.userId);

    if (userId) {
      await upgradeUserToPro(userId, event.type, session);
    }
  }

  return event;
}

async function getBillingPortalState(userId) {
  const user = await getUserPlanRecord(userId);

  return {
    plan: user.plan,
    billingStatus: user.billing_status,
    configured: Boolean(stripeSecretKey && stripePriceIdProMonthly),
  };
}

module.exports = {
  createCheckoutSessionForUser,
  handleStripeWebhook,
  getBillingPortalState,
};
