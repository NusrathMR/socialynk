const defaultOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];
const configuredOrigins = process.env.CORS_ORIGINS;

if (process.env.NODE_ENV === "production" && !configuredOrigins) {
  throw new Error("CORS_ORIGINS must be set to the frontend origin in production.");
}

export const allowedOrigins = configuredOrigins
  ? configuredOrigins.split(",").map((origin) => origin.trim()).filter(Boolean)
  : defaultOrigins;

if (process.env.NODE_ENV === "production" && allowedOrigins.length === 0) {
  throw new Error("CORS_ORIGINS must include at least one frontend origin.");
}

export const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(null, false);
  },
  credentials: true,
};

export function requireTrustedOrigin(req, res, next) {
  const origin = req.get("Origin");

  if (origin && !allowedOrigins.includes(origin)) {
    return res.status(403).json({ message: "Origin is not allowed." });
  }

  return next();
}
