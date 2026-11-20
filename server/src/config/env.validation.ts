import { plainToInstance } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min, MinLength, validateSync } from 'class-validator';

/** Environment variables the server needs at startup. Missing or malformed values stop the boot with a clear message. */
class Env {
  @IsString()
  DATABASE_URL: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT?: number;

  /** Signs sign-in tokens. A long random value; changing it signs everyone out. */
  @IsString()
  @MinLength(16)
  JWT_ACCESS_SECRET: string;

  /** How long a sign-in lasts, e.g. 30d. */
  @IsOptional()
  @IsString()
  JWT_ACCESS_TTL?: string;

  /**
   * Encrypts identity data (Aadhaar numbers, ID documents, face photos). At least 32 characters. Keep a copy
   * somewhere safe outside the server: without it, encrypted documents cannot be opened after a restore.
   */
  @IsOptional()
  @IsString()
  @MinLength(32, { message: 'DATA_ENCRYPTION_KEY must be at least 32 characters (use: openssl rand -base64 48)' })
  DATA_ENCRYPTION_KEY?: string;

  /** Earlier encryption keys, comma separated, kept only to read data from before a key change. */
  @IsOptional()
  @IsString()
  DATA_ENCRYPTION_OLD_KEYS?: string;

  @IsOptional()
  @IsString()
  HOST?: string;

  @IsOptional()
  @IsString()
  CORS_ORIGINS?: string;

  @IsOptional()
  @IsString()
  FILE_STORAGE_DIR?: string;

  /** "true" shows the API docs at /docs on the live server (they are always on in development). */
  @IsOptional()
  @IsString()
  ENABLE_API_DOCS?: string;

  /** GPS tracking server (Traccar), e.g. http://127.0.0.1:4180, and the KeyGo account KeyGo uses to read positions. */
  @IsOptional()
  @IsString()
  TRACCAR_URL?: string;

  @IsOptional()
  @IsString()
  TRACCAR_EMAIL?: string;

  @IsOptional()
  @IsString()
  TRACCAR_PASSWORD?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const env = plainToInstance(Env, config, { enableImplicitConversion: true });
  const errors = validateSync(env, { skipMissingProperties: false });
  if (errors.length) {
    const details = errors.map((e) => `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`).join('\n');
    throw new Error(`Invalid environment:\n${details}\nCopy .env.example to .env and fill it in.`);
  }
  return env;
}
