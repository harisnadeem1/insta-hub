import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const port = Number(process.env.PORT || 4173)
const host = process.env.HOST || '127.0.0.1'

const clientDir = path.join(__dirname, 'dist', 'client')
const serverEntry = path.join(__dirname, 'dist', 'server', 'server.js')

const mod = await import(serverEntry)
const handler = mod.default || mod.handler || mod

function contentType(file) {
  if (file.endsWith('.js')) return 'application/javascript; charset=utf-8'
  if (file.endsWith('.css')) return 'text/css; charset=utf-8'
  if (file.endsWith('.html')) return 'text/html; charset=utf-8'
  if (file.endsWith('.json')) return 'application/json; charset=utf-8'
  if (file.endsWith('.svg')) return 'image/svg+xml'
  if (file.endsWith('.png')) return 'image/png'
  if (file.endsWith('.jpg') || file.endsWith('.jpeg')) return 'image/jpeg'
  if (file.endsWith('.webp')) return 'image/webp'
  if (file.endsWith('.woff2')) return 'font/woff2'
  return 'application/octet-stream'
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`)
    const pathname = decodeURIComponent(url.pathname)

    const assetPath = path.join(clientDir, pathname.replace(/^\/+/, ''))
    if (pathname !== '/' && fs.existsSync(assetPath) && fs.statSync(assetPath).isFile()) {
      res.writeHead(200, { 'Content-Type': contentType(assetPath) })
      fs.createReadStream(assetPath).pipe(res)
      return
    }

    const body = await new Promise((resolve) => {
      const chunks = []
      req.on('data', (c) => chunks.push(c))
      req.on('end', () => resolve(Buffer.concat(chunks)))
    })

    const request = new Request(`http://${req.headers.host}${req.url}`, {
      method: req.method,
      headers: req.headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
    })

    const response = await handler.fetch(request)
    res.writeHead(response.status, Object.fromEntries(response.headers.entries()))

    if (response.body) {
      const ab = await response.arrayBuffer()
      res.end(Buffer.from(ab))
    } else {
      res.end()
    }
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end(`Server error: ${err?.stack || err}`)
  }
})

server.listen(port, host, () => {
  console.log(`Listening on http://${host}:${port}`)
})