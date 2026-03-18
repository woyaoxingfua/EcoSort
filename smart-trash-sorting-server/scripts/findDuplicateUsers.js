const mysql = require('mysql2/promise');
require('dotenv').config();

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'smart_trash_sorting'
};

async function main() {
  const connection = await mysql.createConnection(config);
  try {
    const [rows] = await connection.execute(
      `SELECT nickname, avatar_url, COUNT(*) AS cnt,
              GROUP_CONCAT(id ORDER BY id) AS ids,
              GROUP_CONCAT(openid ORDER BY id) AS openids
       FROM users
       GROUP BY nickname, avatar_url
       HAVING cnt > 1
       ORDER BY cnt DESC, nickname`
    );

    if (!rows.length) {
      console.log('No duplicate nickname/avatar groups found.');
      return;
    }

    console.log(`Found ${rows.length} duplicate groups:`);
    for (const row of rows) {
      console.log('---');
      console.log('nickname:', row.nickname || '(null)');
      console.log('avatar_url:', row.avatar_url || '(null)');
      console.log('count:', row.cnt);
      console.log('ids:', row.ids);
      console.log('openids:', row.openids);
    }
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error('Failed to check duplicates:', err.message);
  process.exit(1);
});
