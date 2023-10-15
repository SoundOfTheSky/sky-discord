import { getVoiceConnection } from '@discordjs/voice';
import { Command } from './index.js';

export default {
  name: 'leave',
  description: 'cmdLeaveDescription',
  handler(interaction) {
    getVoiceConnection(interaction.guild!.id)?.destroy();
  },
} as Command;
