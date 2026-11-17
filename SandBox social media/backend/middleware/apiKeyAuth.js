const { timingSafeEqual } = require('node:crypto');

function apiKeyAuth(req, res, next) {
  const expectedKey = process.env.FAKE_SOCIAL_API_KEY;
  const providedKey = req.get('x-api-key');

  if (typeof expectedKey !== 'string' || expectedKey.trim().length === 0) {
    return res.status(500).json({
      success: false,
      message: 'Publishing authentication is not configured on the server.',
    });
  }

  if (!providedKey) {
    return res.status(401).json({ success: false, message: 'A valid x-api-key header is required.' });
  }

  const expected = Buffer.from(expectedKey);
  const provided = Buffer.from(providedKey);
  const valid = expected.length === provided.length && timingSafeEqual(expected, provided);

  if (!valid) {
    return res.status(401).json({ success: false, message: 'A valid x-api-key header is required.' });
  }

  return next();
}

module.exports = apiKeyAuth;
