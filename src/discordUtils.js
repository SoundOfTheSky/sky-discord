module.exports = async client => {
  client.sendMsg = async (channel, data, deleteAfter) =>
    new Promise(async r => {
      try {
        const msg = await channel.send(data);
        r(msg);
        if (deleteAfter > 0) await msg.delete({ timeout: deleteAfter });
      } catch {}
    });
  client.getGuildVC = id => client.voice.connections.get(id);
  client.emojiCodes = require('./emojiCodes.json');
  client.managerRequest = code =>
    new Promise(r => {
      const id = Math.random();
      client.shard.send([id, code]);
      function onMessage(data) {
        if (Array.isArray(data) && data[0] === id) {
          process.removeListener('message', onMessage);
          r(data[1]);
        }
      }
      process.on('message', onMessage);
    });
  client.numberToEmojis = n =>
    (n + '')
      .split('')
      .reduce(
        (a, b) =>
          a +
          [':zero:', ':one:', ':two:', ':three:', ':four:', ':five:', ':six:', ':seven:', ':eight:', ':nine:'][
            parseInt(b)
          ],
        '',
      );
};
