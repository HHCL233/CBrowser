import { google } from 'googleapis'
import { shell } from 'electron'
import { Elysia, t } from 'elysia'
import { node } from '@elysia/node'

const CLIENT_ID = ''
const REDIRECT_URI = 'http://localhost:3100'
const CLIENT_SECRET = ''

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)

const scopes = ['https://www.googleapis.com/auth/userinfo.profile']

export function googleOAuth(): void {
  const authorizationUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    include_granted_scopes: true
  })

  shell.openExternal(authorizationUrl)
  console.log(`\n${authorizationUrl}`)

  new Elysia({ adapter: node() })
    .get(
      '/',
      async ({ query }) => {
        if (query.error) {
          console.log(`获取token错误: ${query.error}`)
          return `无法获取token: ${query.error}`
        } else if (query.code) {
          const code = query.code

          const { tokens } = await oauth2Client.getToken(code)
          oauth2Client.setCredentials(tokens)
          return `token: ${JSON.stringify(tokens)}`
        }
        return 'OAuth...'
      },
      {
        query: t.Object({
          code: t.Optional(t.String()),
          error: t.Optional(t.String())
        })
      }
    )
    .listen(3100, ({ hostname, port }) => {
      console.log(`OAuth服务器运行在 ${hostname}:${port}`)
    })
}
