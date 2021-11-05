import { ShardingManager } from 'discord.js';
import config from './config.json';
let manager: ShardingManager;
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
  updateStatus();
}
async function updateStatus() {
  const amount = (await manager.fetchClientValues('guilds.cache.size')).reduce(
    (a, b) => (a as number) + (b as number),
    0,
  );
  manager.shards.first()?.eval(`client.user.setActivity('@ on ${amount} servers', {type: 'LISTENING'});`);
}
main();
