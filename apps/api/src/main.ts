import 'dotenv/config';
import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { getEnv } from './config/env.js';
import { DomainExceptionFilter } from './common/filters/domain-exception.filter.js';

async function bootstrap(): Promise<void> {
  const env = getEnv();
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new DomainExceptionFilter());
  await app.listen(env.PORT, '0.0.0.0');
}

await bootstrap();
