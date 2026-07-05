import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const PORT = process.env.PORT || 3000;
const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = path.dirname(currentFilePath);
const clientConfig = {
  apiBaseUrl:
    process.env.VITE_API_BASE_URL ||
    process.env.API_BASE_URL ||
    'http://localhost:8000',
};

// Expose runtime configuration to client bundle
app.get('/config.js', (_req, res) => {
  res.type('application/javascript');
  res.send(`window.__APP_CONFIG__ = ${JSON.stringify(clientConfig)};`);
});

// Serve static assets exported by Vite build
app.use(express.static(path.join(currentDirPath, 'dist')));

// Always return index.html so client-side router can handle routes
app.get('*', (_req, res) => {
  res.sendFile(path.join(currentDirPath, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});
