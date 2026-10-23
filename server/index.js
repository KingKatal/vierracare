// Local / long-running server entry point.
// On Vercel, api/index.js exports the Express app instead.
require('./env');

const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Vierra Care Services running on http://localhost:${PORT}`);
});
