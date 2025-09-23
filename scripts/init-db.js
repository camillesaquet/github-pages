const fs = require('fs');
const path = require('path');
const { initDatabase } = require('../server');

(async () => {
  try {
    const dbPath = path.join(__dirname, '..', 'db', 'agriholann.db');
    const attachmentsDir = path.join(__dirname, '..', 'storage', 'attachments');

    if (fs.existsSync(dbPath)) {
      await fs.promises.rm(dbPath);
    }

    if (fs.existsSync(attachmentsDir)) {
      const files = await fs.promises.readdir(attachmentsDir);
      await Promise.all(files.map((file) => fs.promises.rm(path.join(attachmentsDir, file))));
    }

    await initDatabase();
    console.log('Base de données initialisée.');
    process.exit(0);
  } catch (error) {
    console.error('Erreur lors de la réinitialisation de la base de données', error);
    process.exit(1);
  }
})();
