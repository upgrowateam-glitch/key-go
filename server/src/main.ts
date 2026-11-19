import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { RENEWED_TOKEN_HEADER } from './auth/auth.guard';
import { HttpExceptionFilter } from './common/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  // Signatures and portal settings documents can be larger than the 100 KB default
  app.useBodyParser('json', { limit: '5mb' });
  // Behind Traefik on the same machine: take the visitor's address from X-Forwarded-For (used to limit sign-in attempts)
  app.set('trust proxy', 'loopback');

  // Browser clients: the admin portal and Expo web. Native apps are not subject to CORS.
  const origins = (config.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  // The renewed sign-in token travels in a response header the browser apps must be allowed to read
  app.enableCors({ origin: origins.length ? origins : true, credentials: true, exposedHeaders: [RENEWED_TOKEN_HEADER] });

  // Request bodies are validated against the DTO classes; unknown fields are dropped.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, transformOptions: { enableImplicitConversion: true } }));
  // Every error leaves the API as { statusCode, error, message }.
  app.useGlobalFilters(new HttpExceptionFilter());

  // API docs at /docs: always in development; on the live server only when ENABLE_API_DOCS=true
  const docsOn = process.env.NODE_ENV !== 'production' || config.get<string>('ENABLE_API_DOCS') === 'true';
  const swagger = new DocumentBuilder()
    .setTitle('KeyGo API')
    .setDescription('Car rental platform API used by the customer app and the admin portal.')
    .setVersion('0.1')
    .addBearerAuth()
    .build();
  if (docsOn) SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));

  const port = Number(config.get('PORT') ?? 4000);
  // On the VPS this is 127.0.0.1, so only Traefik on the same machine can reach the API.
  const host = config.get<string>('HOST') ?? '0.0.0.0';
  await app.listen(port, host);
  console.log(`KeyGo API listening on http://${host}:${port}${docsOn ? ' (docs at /docs)' : ''}`);
}

void bootstrap();
