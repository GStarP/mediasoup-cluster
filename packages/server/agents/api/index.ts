import express, { ErrorRequestHandler } from 'express'
import cors from 'cors'
import { getLogger } from '@/common/logger'
import config from './config.json'
import { sign } from 'jsonwebtoken'
import { v4 } from 'uuid'

class APIGateway {
  server: express.Express

  constructor() {
    this.server = express()
  }

  async init() {
    this.server.use(cors())

    this.server.post('/token', async (_, res) => {
      const payload = {
        portal: '127.0.0.1:8080',
        uid: v4(),
      }
      const token = sign(payload, 'dev')
      res.status(200).end(token)
    })

    // handle all error here
    const errorHandler: ErrorRequestHandler = (err, req, res) => {
      getLogger()?.error(err)
      res.status(500).send(err)
    }
    this.server.use(errorHandler)

    this.server.listen(config.port, () => {
      getLogger()?.info(`api-gateway listening on ${config.port}`)
    })
  }
}

new APIGateway().init()
