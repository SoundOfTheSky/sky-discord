const Database = require('better-sqlite3');
const db = new Database(__dirname + '/data.db', { verbose: a => console.log('DB: ' + a) });
db.prepare(
  `
CREATE TABLE IF NOT EXISTS guilds (
  id TEXT PRIMARY KEY,
  language TEXT DEFAULT en,
  last_update INTEGER DEFAULT 0,
  dungeon_stage INTEGER DEFAULT 0,
);`,
).run();
db.prepare(
  `CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  money INTEGER DEFAULT 0,
  last_update INTEGER DEFAULT 0,
  character_slots INTEGER DEFAULT 1,
  votes INTEGER DEFAULT 0,
  boost INTEGER DEFAULT 0
);`,
).run();
db.prepare(
  `CREATE TABLE IF NOT EXISTS characters (
  id INTEGER PRIMARY KEY,
  last_update INTEGER DEFAULT 0,
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  origin TEXT NOT NULL,
  img TEXT NOT NULL,
  rarity INTEGER NOT NULL,
  class INTEGER NOT NULL,
  stamina INTEGER NOT NULL,
  defence INTEGER NOT NULL,
  magic_resistance INTEGER NOT NULL,
  strength INTEGER NOT NULL,
  intelligence INTEGER NOT NULL,
  status INTEGER DEFAULT 0,
  exp INTEGER DEFAULT 0,
  hp INTEGER NOT NULL,
  mana INTEGER NOT NULL,
);
`,
).run();
const valueToQuery = v => (typeof v === 'string' ? `'${v.replace(/\'/g, "''")}'` : v);
db.select = (table, columns, condition) =>
  db.prepare(`SELECT ${columns ? columns.join(',') : '*'} FROM ${table + (condition ? ' WHERE ' + condition : '')}`);
db.insert = (table, data) =>
  db.prepare(
    `INSERT INTO ${table}(${Object.keys(data).join(',')}) VALUES(${Object.values(data).map(valueToQuery).join(',')})`,
  );
db.delete = (table, condition) => db.prepare(`DELETE FROM ${table + (condition ? ' WHERE ' + condition : '')}`);
db.update = (table, data, condition) =>
  db.prepare(
    `UPDATE ${table} SET ${
      Object.entries(data)
        .map(el => el[0] + '=' + valueToQuery(el[1]))
        .join(',') + (condition ? ' WHERE ' + condition : '')
    }`,
  );
module.exports = db;
