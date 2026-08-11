const { hashPassword } = require('../src/utils/password');

async function main() {
  const plainPassword = process.argv[2];
  if (!plainPassword) {
    console.error('Usage: node scripts/create-password-hash.js YourPassword');
    process.exit(1);
  }
  const hash = await hashPassword(plainPassword);
  console.log(hash);
}

main();
