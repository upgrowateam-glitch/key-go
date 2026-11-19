import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Enter a valid email address.' })
  email: string;

  @IsString()
  @MinLength(1, { message: 'Enter your password.' })
  password: string;
}

export class RegisterCustomerDto {
  @IsString()
  @MinLength(1, { message: 'Enter your first name.' })
  @MaxLength(60)
  firstName: string;

  @IsString()
  @MaxLength(60)
  lastName: string;

  @IsString()
  @Matches(/^\+?[0-9\s-]{8,16}$/, { message: 'Enter a valid phone number.' })
  phone: string;

  @IsEmail({}, { message: 'Enter a valid email address.' })
  email: string;

  @IsOptional()
  @IsString()
  dob?: string;

  @IsString()
  @MinLength(6, { message: 'Use at least 6 characters for the password.' })
  @MaxLength(100)
  password: string;
}

export class AcceptInviteDto {
  @IsString()
  @MinLength(8, { message: 'Use at least 8 characters for the password.' })
  @MaxLength(100)
  password: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1, { message: 'Enter your current password.' })
  currentPassword: string;

  @IsString()
  @MinLength(8, { message: 'Use at least 8 characters for the new password.' })
  @MaxLength(100)
  newPassword: string;
}
