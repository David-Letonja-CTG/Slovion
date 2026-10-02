// Dev-server proxy to the API. SLOVION_API_URL lets a second API run on another port,
// e.g. for end-to-end tests next to a developer's own servers.
const target = process.env['SLOVION_API_URL'] ?? 'http://localhost:5080';

export default {
  '/api': { target, secure: false },
  '/content': { target, secure: false },
  '/health': { target, secure: false },
  '/openapi': { target, secure: false },
};
