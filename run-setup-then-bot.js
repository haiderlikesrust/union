/**
 * Run setup then start the bot. Usage:
 *   node run-setup-then-bot.js <admin-email> <admin-password>
 * Example:
 *   node run-setup-then-bot.js ebusiness413@gmail.com "Haider125@"
 */
const { execSync } = require('child_process');
const path = require('path');

const [email, password] = process.argv.slice(2);
if (!email || !password) {
    console.error('Usage: node run-setup-then-bot.js <admin-email> <admin-password>');
    process.exit(1);
}

const projectDir = path.resolve(__dirname);
try {
    console.log('Running setup...\n');
    execSync(`node setup-pb.js "${email}" "${password.replace(/"/g, '\\"')}"`, {
        cwd: projectDir,
        stdio: 'inherit',
    });
    console.log('\nStarting bot...\n');
    execSync('node bot.mjs', {
        cwd: projectDir,
        stdio: 'inherit',
    });
} catch (e) {
    if (e.status !== null) process.exit(e.status);
    throw e;
}
