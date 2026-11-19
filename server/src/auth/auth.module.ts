import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { PermissionsService } from './permissions.service';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        // A sign-in lasts this long without use; the guard renews it daily while it is being used
        signOptions: { expiresIn: (config.get<string>('JWT_ACCESS_TTL') || '7d') as never },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PermissionsService, { provide: APP_GUARD, useClass: AuthGuard }],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
