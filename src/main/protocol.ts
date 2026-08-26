import { protocol, net } from 'electron'
import { join, normalize, extname } from 'node:path'
import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { is } from '@electron-toolkit/utils'

export const CB_SCHEME = 'cb-chrome'

export const privilegedSchemes = [
  {
    scheme: CB_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      bypassCSP: true
    }
  }
]

/**
 * 开发模式下向 Vite 开发服务器取资源
 */
const devFetch = (targetUrl: string): Promise<Response> => globalThis.fetch(targetUrl)

export function registerCbProtocol(): void {
  protocol.handle(CB_SCHEME, (request: Request): Promise<Response> => {
    const url = new URL(request.url)
    const pageName = url.hostname
    const subPath = url.pathname

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      const devBase = process.env['ELECTRON_RENDERER_URL']

      // Vite 开发服务器的内部特殊路径
      if (
        subPath.startsWith('/@fs/') ||
        subPath.startsWith('/@id/') ||
        subPath.startsWith('/@vite/') ||
        subPath.startsWith('/node_modules/')
      ) {
        return devFetch(`${devBase}${subPath}${url.search}`)
      }

      // HTML 页面本体
      if (subPath === '/' || !extname(subPath)) {
        return devFetch(`${devBase}/${pageName}/index.html`)
      }

      // 常规业务静态资源
      let cleanSubPath = subPath
      if (cleanSubPath.startsWith(`/${pageName}`)) {
        cleanSubPath = cleanSubPath.replace(`/${pageName}`, '')
      }

      return devFetch(`${devBase}/${pageName}${cleanSubPath}${url.search}`)
    }

    // 生产环境:先按「页面目录」解析,再回退到 renderer 根目录。
    //
    // 打包后的 index.html 引用的是 `../assets/xxx.js`,相对 `cb-chrome://menu/`
    // 解析后仍是 `/assets/xxx.js`(无法越过 URL 根),
    // 因此不能只拼 `renderer/<page>/assets/...` —— 那个路径并不存在,
    // 会让菜单页的脚本和样式全部 ERR_FILE_NOT_FOUND。
    if (subPath === '/' || !extname(subPath)) {
      return serveFile(join(__dirname, '../renderer', pageName, 'index.html'))
    }

    const rendererRoot = join(__dirname, '../renderer')
    let cleanSubPath = subPath
    if (cleanSubPath.startsWith(`/${pageName}/`)) {
      cleanSubPath = cleanSubPath.slice(pageName.length + 1)
    }

    const candidates = [
      join(rendererRoot, pageName, normalize(cleanSubPath)),
      join(rendererRoot, normalize(cleanSubPath))
    ]
    const resolved = candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]

    return serveFile(resolved)
  })
}

function serveFile(absolutePath: string): Promise<Response> {
  return net.fetch(pathToFileURL(absolutePath).toString())
}
