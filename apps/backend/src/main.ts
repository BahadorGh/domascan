import { NestFactory } from '@nestjs/core'
import { AppModule } from './modules/app.module.js'
import { ValidationPipe } from '@nestjs/common'
import { TransformInterceptor } from './common/transform.interceptor.js'
import * as dotenv from 'dotenv';
dotenv.config();


async function bootstrap() {
    const app = await NestFactory.create(AppModule, { cors: true })
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    app.useGlobalInterceptors(new TransformInterceptor())
    const port = process.env.PORT ? Number(process.env.PORT) : 4000
    await app.listen(port)
    // eslint-disable-next-line no-console
    console.log(`Backend listening on http://localhost:${port}`)
}

bootstrap()
