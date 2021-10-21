const { ShardingManager } = require('discord.js');
const config = require('./config.json');
let manager;
async function main() {
  manager = new ShardingManager(__dirname + '/bot.js', {
    token: config.token,
    totalShards: 1,
    execArgv: ['--trace-warnings'],
  });
  manager.on('shardCreate', shard => {
    shard.on('message', data => {
      if (Array.isArray(data)) shard.send([data[0], eval(data[1])]);
    });
    console.log(`Launched shard ${shard.id}`);
  });
  await manager.spawn();
  setDefaultStatus();
}
const getUser = id => {
  const user = db.select('users', undefined, `id='${id}'`).get();
  if (user) return user;
  db.insert('users', { id }).run();
  return db.select('users', undefined, `id='${id}'`).get();
};
async function setDefaultStatus() {
  const amount = (await manager.fetchClientValues('guilds.cache.size')).reduce((a, b) => a + b, 0);
  manager.shards.first().eval(`client.user.setActivity('@ on ${amount} servers', {type: 'LISTENING'});`);
}
function guildCreate({ name, id }) {
  console.log(`[New Guild] ${name} - ${id}`);
}
function guildDelete({ name, id }) {
  console.log(`[Delete Guild] ${name} - ${id}`);
}
main();
