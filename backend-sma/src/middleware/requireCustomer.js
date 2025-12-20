// src/middleware/requireCustomer.js
export default function requireCustomer(req, res, next) {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    if (req.user.role !== 'CUSTOMER') {
      return res.status(403).json({ message: 'Customer only' });
    }
    next();
  } catch (err) {
    next(err);
  }
}
