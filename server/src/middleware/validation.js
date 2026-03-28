const JSON_BODY_LIMIT = "32kb";

function createValidationError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function validateNonEmptyString(value, fieldName, maxLength = 5000) {
  const normalized = String(value || "").trim();

  if (!normalized) {
    throw createValidationError(`${fieldName} is required`);
  }

  if (normalized.length > maxLength) {
    throw createValidationError(`${fieldName} must be ${maxLength} characters or fewer`);
  }

  return normalized;
}

function validateInteger(value, fieldName) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw createValidationError(`${fieldName} must be a valid integer`);
  }

  return parsed;
}

function validateEmail(value, fieldName) {
  const normalized = validateNonEmptyString(value, fieldName, 320).toLowerCase();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(normalized)) {
    throw createValidationError(`${fieldName} must be a valid email address`);
  }

  return normalized;
}

function validateOptionalString(value, fieldName, maxLength = 255) {
  if (value == null || String(value).trim() === "") {
    return "";
  }

  return validateNonEmptyString(value, fieldName, maxLength);
}

function validatePassword(value, fieldName = "password") {
  const normalized = validateNonEmptyString(value, fieldName, 200);

  if (normalized.length < 10) {
    throw createValidationError(`${fieldName} must be at least 10 characters`);
  }

  if (!/[a-z]/i.test(normalized) || !/\d/.test(normalized)) {
    throw createValidationError(`${fieldName} must include at least one letter and one number`);
  }

  return normalized;
}

function validationMiddleware(validate) {
  return function runValidation(req, res, next) {
    try {
      req.validated = {
        ...(req.validated || {}),
        ...validate(req),
      };
      next();
    } catch (error) {
      next(error);
    }
  };
}

const validateIdeaSubmission = validationMiddleware((req) => ({
  userIdea: validateNonEmptyString(req.body.userIdea, "userIdea", 1000),
}));

const validateValidationIdeaSubmission = validationMiddleware((req) => ({
  ideaText: validateNonEmptyString(req.body.ideaText, "ideaText", 1000),
}));

const validateIdeaSelection = validationMiddleware((req) => ({
  projectId: validateInteger(req.body.projectId, "projectId"),
  ideaIndex: validateInteger(req.body.ideaIndex, "ideaIndex"),
}));

const validateProjectIdParam = validationMiddleware((req) => ({
  projectId: validateInteger(req.params.projectId, "projectId"),
}));

const validateIdeaIdParam = validationMiddleware((req) => ({
  ideaId: validateInteger(req.params.ideaId, "ideaId"),
}));

const validateWaitlistSignup = validationMiddleware((req) => ({
  ideaId: validateInteger(req.body.ideaId, "ideaId"),
  email: validateEmail(req.body.email, "email"),
  interviewRequested: Boolean(req.body.interviewRequested),
}));

const validateSignup = validationMiddleware((req) => ({
  name: validateOptionalString(req.body.name, "name", 120),
  email: validateEmail(req.body.email, "email"),
  password: validatePassword(req.body.password, "password"),
}));

const validateLogin = validationMiddleware((req) => ({
  email: validateEmail(req.body.email, "email"),
  password: validateNonEmptyString(req.body.password, "password", 200),
}));

const validateEmailVerification = validationMiddleware((req) => ({
  token: validateNonEmptyString(req.query.token || req.body.token, "token", 500),
}));

const validateResendVerification = validationMiddleware((req) => ({
  email: validateEmail(req.body.email, "email"),
}));

const validateProfileUpdate = validationMiddleware((req) => ({
  name: validateOptionalString(req.body.name, "name", 120),
}));

const validateCreateTeam = validationMiddleware((req) => ({
  name: validateNonEmptyString(req.body.name, "name", 120),
}));

const validateJoinTeam = validationMiddleware((req) => ({
  inviteCode: validateNonEmptyString(req.body.inviteCode, "inviteCode", 32).toUpperCase(),
}));

const validateCheckin = validationMiddleware((req) => {
  const teamId = validateInteger(req.body.teamId, "teamId");
  const moodScore = validateInteger(req.body.moodScore, "moodScore");
  const note = String(req.body.note || "").trim();

  if (moodScore < 1 || moodScore > 5) {
    throw createValidationError("moodScore must be between 1 and 5");
  }

  if (note.length > 500) {
    throw createValidationError("note must be 500 characters or fewer");
  }

  return {
    teamId,
    moodScore,
    note,
  };
});

const validateTeamDataQuery = validationMiddleware((req) => ({
  teamId: validateInteger(req.query.teamId, "teamId"),
}));

const validateInviteMember = validationMiddleware((req) => ({
  teamId: validateInteger(req.body.teamId, "teamId"),
  inviteEmail: validateEmail(req.body.inviteEmail, "inviteEmail"),
}));

const validateContactSubmission = validationMiddleware((req) => ({
  name: validateNonEmptyString(req.body.name, "name", 120),
  email: validateEmail(req.body.email, "email"),
  message: validateNonEmptyString(req.body.message, "message", 2000),
}));

module.exports = {
  JSON_BODY_LIMIT,
  createValidationError,
  validatePassword,
  validateSignup,
  validateLogin,
  validateEmailVerification,
  validateResendVerification,
  validateProfileUpdate,
  validateCreateTeam,
  validateJoinTeam,
  validateCheckin,
  validateTeamDataQuery,
  validateInviteMember,
  validateIdeaSubmission,
  validateValidationIdeaSubmission,
  validateIdeaSelection,
  validateProjectIdParam,
  validateIdeaIdParam,
  validateWaitlistSignup,
  validateContactSubmission,
};
