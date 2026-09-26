import { ArrayMinSize, IsArray, IsIn, IsUUID } from 'class-validator';

export class BulkUpdateListingsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  ids!: string[];

  @IsIn(['approved', 'rejected'])
  status!: 'approved' | 'rejected';
}
