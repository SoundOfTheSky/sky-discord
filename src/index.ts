import { ShardingManager } from 'discord.js';
import http from 'http';
import dotenv from 'dotenv';
dotenv.config();

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('OK');
});
server
  .listen(process.env.PORT || 80)
  .once('listening', () => console.log('Listening on port ' + (process.env.PORT || 80)));

let manager: ShardingManager;
async function main() {
  manager = new ShardingManager(__dirname + '/bot.js', {
    token: process.env.TOKEN,
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
