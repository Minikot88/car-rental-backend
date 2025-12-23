export function authMiddleware(req, res, next) {
  const token = req.headers["x-psu-token"];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Token required"
    });
  }

  req.token = token;
  next();
}
