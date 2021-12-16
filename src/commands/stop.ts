import { Command } from '@/interfaces';
import leave from './leave';
const cmd: Command = { ...leave, name: 'stop' };
export default cmd;
