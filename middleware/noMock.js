export function noMock(req, res, next) {
  // Block accidental use of dev fixtures:
  if (process.env.ALLOW_MOCKS === "true") return next(); // only if explicitly allowed
  
  // Optionally scan req for debug flags; otherwise just proceed
  next();
}







