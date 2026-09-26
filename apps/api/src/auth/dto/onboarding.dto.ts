import { IsIn, IsNotEmpty, IsString } from 'class-validator';

// role is restricted to 'seeker' | 'owner' at validation time, deliberately excluding
// 'admin' — this is what makes root CLAUDE.md §6's "cannot set their own role to admin"
// rule structurally true rather than something enforced later and easy to forget. Prisma's
// UserRole enum has a third value ('admin') that must never be reachable from this DTO.
export class OnboardingDto {
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsIn(['seeker', 'owner'])
  role!: 'seeker' | 'owner';
}
