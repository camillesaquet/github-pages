const fs = require('fs');
const path = require('path');
const { initDatabase, paths } = require('../server');

(async () => {
  try {
    const { DB_PATH: dbPath, ATTACHMENTS_DIR: attachmentsDir } = paths;

    if (fs.existsSync(dbPath)) {
      await fs.promises.rm(dbPath);
    }

    if (fs.existsSync(attachmentsDir)) {
      const files = await fs.promises.readdir(attachmentsDir);
      await Promise.all(files.map((file) => fs.promises.rm(path.join(attachmentsDir, file))));
    }

    await initDatabase();
    console.log(`Base de données initialisée (${dbPath}).`);
    process.exit(0);
  } catch (error) {
    console.error('Erreur lors de la réinitialisation de la base de données', error);
    process.exit(1);
  }
})();
