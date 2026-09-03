import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const isWin = process.platform === 'win32'
const script = path.join(root, isWin ? 'dev-local.ps1' : 'dev-local.sh')
const command = isWin ? 'powershell' : 'bash'
const args = isWin
  ? ['-ExecutionPolicy', 'Bypass', '-File', script]
  : [script]

const child = spawn(command, args, {
  cwd: root,
  stdio: 'inherit',
  shell: false,
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 1)
})
