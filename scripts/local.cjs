// Inicializa e encerra apenas o ambiente portátil preparado neste workspace.
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn, spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const tools = path.resolve(root, '../.tools');
const statePath = path.join(tools, 'sistema-bet-local.json');
const mysqlBase = path.join(tools, 'mysql-8.4.13-winx64/bin');
const mysqlConfig = path.join(tools, 'mysql-local/my.ini');
const mysqlClient = path.join(tools, 'mysql-local/root.cnf');
const nextBin = path.join(root, 'node_modules/next/dist/bin/next');

function listening(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    socket.setTimeout(500);
    const finish = (value) => { socket.destroy(); resolve(value); };
    socket.once('connect', () => finish(true)); socket.once('error', () => finish(false)); socket.once('timeout', () => finish(false));
  });
}
async function waitPort(port) {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (await listening(port)) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`O serviço na porta ${port} não iniciou. Consulte os logs em .tools.`);
}
function appProcess(pid) {
  if (!Number.isInteger(pid) || pid < 1) return false;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', `$ErrorActionPreference = 'Stop'; (Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}').CommandLine`], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error('Não foi possível verificar o processo local. Execute o atalho em um terminal com acesso aos processos do Windows.');
  return result.stdout.includes(nextBin) && result.stdout.includes('dev');
}
function background(executable, args, logName) {
  const log = fs.openSync(path.join(tools, logName), 'a');
  const child = spawn(executable, args, { cwd: root, detached: true, windowsHide: true, stdio: ['ignore', log, log] });
  child.on('error', (error) => { console.error(`Não foi possível iniciar: ${error.message}`); process.exitCode = 1; });
  child.unref(); fs.closeSync(log);
  return child.pid;
}
async function main() {
  if (!fs.existsSync(mysqlConfig)) throw new Error('O MySQL portátil deste workspace ainda não foi configurado. Consulte docs/administracao.md.');
  const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : {};
  if (process.argv[2] === 'stop') {
    if (appProcess(state.appPid)) {
      const stopped = spawnSync('taskkill.exe', ['/PID', String(state.appPid), '/T', '/F'], { encoding: 'utf8', windowsHide: true });
      if (stopped.status !== 0) throw new Error('Não foi possível encerrar os processos do aplicativo local.');
    }
    const result = spawnSync(path.join(mysqlBase, 'mysqladmin.exe'), [`--defaults-extra-file=${mysqlClient}`, 'shutdown'], { encoding: 'utf8', windowsHide: true });
    if (result.status !== 0 && await listening(3307)) throw new Error('Não foi possível encerrar o MySQL local.');
    fs.writeFileSync(statePath, '{}');
    console.log('Aplicativo e MySQL local encerrados.');
    return;
  }
  if (!await listening(3307)) {
    background(path.join(mysqlBase, 'mysqld.exe'), [`--defaults-file=${mysqlConfig}`], 'mysql-start.log');
    await waitPort(3307);
  }
  const check = spawnSync(path.join(mysqlBase, 'mysql.exe'), [`--defaults-extra-file=${mysqlClient}`, '--batch', '--skip-column-names'], { input: 'SELECT 1;', encoding: 'utf8', windowsHide: true });
  if (check.status !== 0) throw new Error('Não foi possível autenticar no MySQL local.');
  if (await listening(3000)) {
    if (!appProcess(state.appPid)) throw new Error('A porta 3000 está ocupada por outro processo.');
  } else {
    const appPid = background(process.execPath, [nextBin, 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', '3000'], 'sistema-bet.log');
    fs.writeFileSync(statePath, JSON.stringify({ appPid }));
    await waitPort(3000);
  }
  console.log('Sistema-Bet disponível em http://localhost:3000');
  console.log('Painel administrativo: http://localhost:3000/admin');
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
