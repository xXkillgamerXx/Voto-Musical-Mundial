import { spawn, spawnSync } from 'node:child_process'
import { createConnection } from 'node:net'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const newsRoot = path.join(path.dirname(root), 'musicmundial')
const isWin = process.platform === 'win32'
const npmCmd = isWin ? 'npm.cmd' : 'npm'
const votePort = 5174
const newsPort = 5173
const children = []
const viteBin = (projectRoot) => path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js')

const fail = (message) => {
  console.error(message)
  process.exit(1)
}

const waitPort = (port, timeoutMs = 45000) =>
  new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs
    let settled = false
    const hosts = ['127.0.0.1', '::1']
    const done = (error) => {
      if (settled) return
      settled = true
      if (error) reject(error)
      else resolve()
    }
    const tryConnect = (hostIndex = 0) => {
      if (settled) return
      if (Date.now() > deadline) {
        done(new Error(`Puerto ${port} no arranco a tiempo`))
        return
      }
      const host = hosts[hostIndex % hosts.length]
      const socket = createConnection({ host, port })
      socket.setTimeout(800)
      const retry = () => {
        socket.destroy()
        setTimeout(() => tryConnect(hostIndex + 1), 250)
      }
      socket.once('connect', () => {
        socket.destroy()
        done()
      })
      socket.once('timeout', retry)
      socket.once('error', retry)
    }
    tryConnect()
  })

const spawnLogged = (command, args, cwd, name) => {
  const child = spawn(command, args, {
    cwd,
    stdio: 'inherit',
    windowsHide: true,
    env: process.env,
  })
  child.on('exit', (code, signal) => {
    if (signal) return
    if (code && code !== 0) {
      console.error(`[${name}] salio con codigo ${code}`)
    }
  })
  children.push(child)
  return child
}

const stopAll = () => {
  for (const child of children) {
    if (!child?.pid) continue
    if (isWin) {
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
    } else {
      child.kill('SIGTERM')
    }
  }
}

if (!existsSync(newsRoot)) {
  fail(`No se encontro Music Mundial en ${newsRoot}`)
}

if (!existsSync(path.join(newsRoot, 'node_modules'))) {
  console.log('Instalando dependencias de musicmundial...')
  const install = spawnSync(npmCmd, ['install'], {
    cwd: newsRoot,
    stdio: 'inherit',
    shell: isWin,
    windowsHide: true,
  })
  if (install.status !== 0) {
    fail('npm install fallo en musicmundial.')
  }
}

process.on('SIGINT', () => {
  stopAll()
  process.exit(0)
})
process.on('SIGTERM', () => {
  stopAll()
  process.exit(0)
})

console.log('Votacion  -> http://localhost:5173/vote/')
console.log('Landing   -> http://localhost:5173/')

spawnLogged(process.execPath, [viteBin(root)], root, 'vote')
await waitPort(votePort)
spawnLogged(process.execPath, [viteBin(newsRoot)], newsRoot, 'news')
await waitPort(newsPort)

console.log('')
console.log('Listo:')
console.log('  http://localhost:5173/       Music Mundial')
console.log('  http://localhost:5173/vote/  Votacion')
