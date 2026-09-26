import { IsIn } from 'class-validator';

export class ResolveReportDto {
  // Mirrors root CLAUDE.md §14.10's admin Reports queue actions exactly: Dismiss (keep
  // the listing live) or Confirm (revert the listing to `pending` for re-review).
  @IsIn(['dismiss', 'confirm'])
  action!: 'dismiss' | 'confirm';
}
