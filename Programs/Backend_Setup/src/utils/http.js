export function sendSuccess(res, data, status = 200) {
  return res.status(status).json({ data });
}

export function sendError(res, status, message, meta = {}) {
  return res.status(status).json({ message, error: { message, ...meta } });
}
