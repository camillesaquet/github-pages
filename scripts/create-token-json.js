#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function printUsage() {
  console.log(`Usage: node scripts/create-token-json.js --refresh-token=<token> [--output=token.json] [--force]\n`);
  console.log('Options:');
  console.log('  --refresh-token  Jeton d\'actualisation généré via OAuth2 (obligatoire).');
  console.log('  --output         Emplacement du fichier token.json à générer (défaut : ./token.json).');
  console.log('  --force          Écrase le fichier existant le cas échéant.');
}

function parseArgs(argv) {
  const result = {
    refreshToken: process.env.GMAIL_REFRESH_TOKEN || '',
    output: path.resolve(__dirname, '..', 'token.json'),
    force: false,
  };

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      result.help = true;
      return result;
    }

    if (arg === '--force') {
      result.force = true;
      continue;
    }

    if (arg.startsWith('--refresh-token=')) {
      result.refreshToken = arg.split('=')[1];
      continue;
    }

    if (arg.startsWith('--output=')) {
      const value = arg.split('=')[1];
      if (value) {
        result.output = path.resolve(process.cwd(), value);
      }
      continue;
    }
  }

  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  if (!args.refreshToken) {
    console.error("⚠️  Aucun refresh_token fourni. Utilisez --refresh-token=<token> ou définissez GMAIL_REFRESH_TOKEN.");
    printUsage();
    process.exit(1);
  }

  const trimmedToken = args.refreshToken.trim();
  if (!trimmedToken) {
    console.error('⚠️  Le refresh_token est vide après suppression des espaces.');
    process.exit(1);
  }

  const outputDir = path.dirname(args.output);
  fs.mkdirSync(outputDir, { recursive: true });

  if (fs.existsSync(args.output) && !args.force) {
    console.error(`⚠️  Le fichier ${args.output} existe déjà. Utilisez --force pour l\'écraser.`);
    process.exit(1);
  }

  const content = {
    refresh_token: trimmedToken,
  };

  fs.writeFileSync(args.output, `${JSON.stringify(content, null, 2)}\n`, 'utf8');

  console.log(`✅ Fichier token.json généré : ${args.output}`);
}

main().catch((error) => {
  console.error('❌ Impossible de créer token.json :', error.message);
  process.exit(1);
});
