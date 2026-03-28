const jwt = require("jsonwebtoken");
const db = require("../db");
const { jwtSecret } = require("../config");
const AUTH_COOKIE_NAME = "teampulse_auth";

function getCookieValue(req, name) {
  const cookieHeader = req.headers.cookie;

  if (!cookieHeader) {
    return null;
  }

  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  if (!cookie) {
    return null;
  }

  return decodeURIComponent(cookie.slice(name.length + 1));
}

function requireAuth(req, res, next) {
  const authorizationHeader = String(req.headers.authorization || "").trim();
  const bearerToken = authorizationHeader.startsWith("Bearer ")
    ? authorizationHeader.slice("Bearer ".length).trim()
    : "";
  const token = bearerToken || getCookieValue(req, AUTH_COOKIE_NAME);

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const payload = jwt.verify(token, jwtSecret);

    return db
      .queryOne("users", {
        filter: {
          id: Number(payload.sub),
        },
        projection: ["id", "email", "email_verified"],
      })
      .then((user) => {
        if (!user) {
          return res.status(401).json({ error: "Invalid or expired token" });
        }

        if (!user.email_verified) {
          return res
            .status(403)
            .json({ error: "Verify your email before accessing this resource" });
        }

        req.user = { id: user.id, email: user.email };
        return next();
      })
      .catch(() => res.status(401).json({ error: "Invalid or expired token" }));
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

module.exports = { requireAuth };
