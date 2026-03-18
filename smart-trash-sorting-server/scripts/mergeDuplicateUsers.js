const mysql = require('mysql2/promise');
require('dotenv').config();

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'smart_trash_sorting'
};

const SUM_FIELDS = ['total_points', 'identify_count', 'exchange_count', 'favorite_count', 'share_count'];
const MAX_FIELDS = ['check_in_days'];
const DATE_FIELDS = ['last_check_date'];

function toInt(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function pickTarget(rows) {
  return rows.sort((a, b) => {
    if (toInt(b.total_points) !== toInt(a.total_points)) return toInt(b.total_points) - toInt(a.total_points);
    if (toInt(b.identify_count) !== toInt(a.identify_count)) return toInt(b.identify_count) - toInt(a.identify_count);
    if (toInt(b.check_in_days) !== toInt(a.check_in_days)) return toInt(b.check_in_days) - toInt(a.check_in_days);
    if (String(b.updated_at) !== String(a.updated_at)) return String(b.updated_at) > String(a.updated_at) ? 1 : -1;
    return a.id - b.id;
  })[0];
}

async function main() {
  const connection = await mysql.createConnection(config);
  try {
    const [columns] = await connection.execute('SHOW COLUMNS FROM users');
    const columnNames = new Set(columns.map((c) => c.Field));

    const sumFields = SUM_FIELDS.filter((f) => columnNames.has(f));
    const maxFields = MAX_FIELDS.filter((f) => columnNames.has(f));
    const dateFields = DATE_FIELDS.filter((f) => columnNames.has(f));

    const [groups] = await connection.execute(
      `SELECT nickname, avatar_url, COUNT(*) AS cnt,
              GROUP_CONCAT(id ORDER BY id) AS ids
       FROM users
       WHERE openid LIKE 'dev_%'
       GROUP BY nickname, avatar_url
       HAVING cnt > 1
       ORDER BY cnt DESC, nickname`
    );

    if (!groups.length) {
      console.log('No duplicate dev users found.');
      return;
    }

    for (const group of groups) {
      const ids = String(group.ids)
        .split(',')
        .map((v) => parseInt(v, 10))
        .filter((v) => Number.isFinite(v));

      if (ids.length < 2) continue;

      const [rows] = await connection.execute(
        `SELECT * FROM users WHERE id IN (${ids.map(() => '?').join(',')})`,
        ids
      );

      const target = pickTarget(rows);
      const sources = rows.filter((r) => r.id !== target.id);

      for (const source of sources) {
        await connection.beginTransaction();
        try {
          // 1) 处理存在唯一约束的表
          await connection.execute(
            `DELETE s FROM user_favorites s
             JOIN user_favorites t
               ON t.user_id = ? AND s.user_id = ?
              AND t.trash_id = s.trash_id`,
            [target.id, source.id]
          );
          await connection.execute(
            `UPDATE user_favorites SET user_id = ? WHERE user_id = ?`,
            [target.id, source.id]
          );

          await connection.execute(
            `DELETE s FROM user_achievements s
             JOIN user_achievements t
               ON t.user_id = ? AND s.user_id = ?
              AND t.achievement_id = s.achievement_id`,
            [target.id, source.id]
          );
          await connection.execute(
            `UPDATE user_achievements SET user_id = ? WHERE user_id = ?`,
            [target.id, source.id]
          );

          // user_tasks: 合并同日同任务记录的完成次数
          await connection.execute(
            `UPDATE user_tasks t
             JOIN user_tasks s
               ON t.user_id = ? AND s.user_id = ?
              AND t.task_id = s.task_id
              AND (t.complete_date <=> s.complete_date)
             SET t.complete_count = IFNULL(t.complete_count, 1) + IFNULL(s.complete_count, 1)`,
            [target.id, source.id]
          );
          await connection.execute(
            `DELETE s FROM user_tasks s
             JOIN user_tasks t
               ON t.user_id = ? AND s.user_id = ?
              AND t.task_id = s.task_id
              AND (t.complete_date <=> s.complete_date)`,
            [target.id, source.id]
          );
          await connection.execute(
            `UPDATE user_tasks SET user_id = ? WHERE user_id = ?`,
            [target.id, source.id]
          );

          // 2) 直接迁移外键表
          const simpleTables = [
            'point_records',
            'identify_history',
            'verify_records',
            'exchange_records',
            'user_feedback'
          ];
          for (const table of simpleTables) {
            await connection.execute(
              `UPDATE ${table} SET user_id = ? WHERE user_id = ?`,
              [target.id, source.id]
            );
          }

          // 3) 合并 users 表统计字段
          const updates = [];
          const params = [];

          for (const field of sumFields) {
            const value = toInt(target[field]) + toInt(source[field]);
            updates.push(`${field} = ?`);
            params.push(value);
          }

          for (const field of maxFields) {
            const value = Math.max(toInt(target[field]), toInt(source[field]));
            updates.push(`${field} = ?`);
            params.push(value);
          }

          for (const field of dateFields) {
            const t = target[field] ? new Date(target[field]).getTime() : 0;
            const s = source[field] ? new Date(source[field]).getTime() : 0;
            const value = t >= s ? target[field] : source[field];
            updates.push(`${field} = ?`);
            params.push(value || null);
          }

          if (updates.length) {
            params.push(target.id);
            await connection.execute(
              `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
              params
            );
          }

          // 4) 删除源用户
          await connection.execute(`DELETE FROM users WHERE id = ?`, [source.id]);

          await connection.commit();
          console.log(`Merged user ${source.id} -> ${target.id}`);
        } catch (err) {
          await connection.rollback();
          console.error(`Failed to merge ${source.id} -> ${target.id}:`, err.message);
        }
      }
    }
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error('Merge failed:', err.message);
  process.exit(1);
});
