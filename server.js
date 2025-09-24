const express = require('express');
const path = require('path');
const apiRouter = require('./src/api');
const { getDb } = require('./src/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure database is initialized on startup
getDb();

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: false }));

app.use('/uploads', express.static(path.join(__dirname, 'public_html', 'uploads')));
app.use('/api', apiRouter);
app.use(express.static(path.join(__dirname, 'public_html')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public_html', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Agri Holann app listening on port ${PORT}`);
});
