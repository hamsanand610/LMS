import { writeFileSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { APP_CONFIG, type AppConfig } from './core/config/env.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const config = app.get<AppConfig>(APP_CONFIG);

  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  configureApp(app, config);

  if (config.APP_ENV !== 'production') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('LMS Platform API')
        .setVersion('1.0')
        .setDescription('Reusable learning and placement platform — API v1')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document, { jsonDocumentUrl: 'api/docs-json' });
    if (config.APP_ENV === 'local') {
      writeFileSync('openapi.json', JSON.stringify(document, null, 2));
    }
  }

  await app.listen(config.PORT);
  app
    .get(Logger)
    .log(
      `API listening on ${config.API_BASE_URL} (${config.APP_ENV}, client ${config.CLIENT_KEY})`,
    );
}

await bootstrap();
