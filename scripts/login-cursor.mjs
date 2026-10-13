import { spawn } from 'node:child_process';
import { cursorExecutable } from '../server/cursor.mjs';
const cli=cursorExecutable();
const child=spawn(cli.command,[...cli.args,'login'],{shell:false,windowsHide:true,stdio:'inherit'});
child.on('error',()=>{console.error('未找到 Cursor CLI，请先安装。');process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code||0;});
