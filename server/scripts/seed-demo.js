const { closeDatabase } = require("../src/db");
const { incrementVisitForLandingSlug } = require("../src/services/validationStore");
const {
  addWaitlistAndRefreshDecision,
  getIdeaStateForDashboard,
  startValidationWorkflow,
} = require("../src/workflow/validationWorkflow");

const DEMO_IDEA =
  "An AI copilot that helps B2B SaaS founders validate pricing and messaging before they build new features.";

function buildFakeRequest() {
  return {
    protocol: "http",
    headers: {},
    get(name) {
      if (String(name).toLowerCase() === "host") {
        return process.env.DEMO_HOST || `localhost:${process.env.PORT || "4000"}`;
      }

      return "";
    },
  };
}

async function main() {
  const started = await startValidationWorkflow(DEMO_IDEA, buildFakeRequest());
  const slug = started.landingPage.slug;

  for (let index = 0; index < 40; index += 1) {
    await incrementVisitForLandingSlug(slug);
  }

  const signups = [
    { email: "judge1@example.com", interviewRequested: true },
    { email: "judge2@example.com", interviewRequested: false },
    { email: "judge3@example.com", interviewRequested: true },
    { email: "judge4@example.com", interviewRequested: false },
    { email: "judge5@example.com", interviewRequested: false },
    { email: "judge6@example.com", interviewRequested: false },
  ];

  for (const signup of signups) {
    await addWaitlistAndRefreshDecision({
      ideaId: started.idea.id,
      email: signup.email,
      interviewRequested: signup.interviewRequested,
    });
  }

  const finalState = await getIdeaStateForDashboard(started.idea.id, started.accessToken);

  console.log("Demo validation run created");
  console.log(`Idea ID: ${finalState.idea.id}`);
  console.log(`Access token: ${started.accessToken}`);
  console.log(`Landing page: ${finalState.landingPage.url}`);
  console.log(
    `Metrics: ${finalState.analytics.visits} visits, ${finalState.analytics.signups} signups, ${finalState.analytics.interviewRequests} interview requests`
  );
  console.log(
    `Decision: ${(finalState.decision.displayDecision || finalState.decision.decision).toUpperCase()} (${finalState.decision.evidenceStatus})`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    closeDatabase().catch((error) => {
      console.error(error);
    });
  });
