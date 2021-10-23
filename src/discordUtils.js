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
  client.managerRequest = code =>
    new Promise(r => {
      const id = Math.random().toString(36).slice(2);
      client.shard.send([id, code]);
      function onMessage(data) {
        if (data[0] !== id) return;
        process.removeListener('message', onMessage);
        r(data[1]);
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
