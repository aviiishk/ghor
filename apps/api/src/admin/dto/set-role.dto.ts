import { IsIn } from 'class-validator';

export class SetRoleDto {
  @IsIn(['seeker', 'owner', 'admin'])
  role!: 'seeker' | 'owner' | 'admin';
}
