import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma, type AppConfig } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AuditService,
  type AuditContext,
  type AuditActor,
  type Db,
} from '../audit/audit.service';
import { CONFIG_BY_KEY, CONFIG_REGISTRY } from './config-registry';

@Injectable()
export class AppSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // Typed read with registry default. A stored value that no longer validates (e.g. set
  // before validation existed) falls back to the default instead of propagating garbage.
  async get<T>(key: string, db: Db = this.prisma): Promise<T> {
    const def = CONFIG_BY_KEY.get(key);
    if (!def) throw new Error(`Unknown config key ${key}`);
    const row = await db.appConfig.findUnique({ where: { key } });
    if (!row || def.validate(row.value) !== null) return def.defaultValue as T;
    return row.value as T;
  }

  async publicValues(): Promise<Record<string, unknown>> {
    const rows = await this.prisma.appConfig.findMany({
      where: {
        key: { in: CONFIG_REGISTRY.filter((d) => d.public).map((d) => d.key) },
      },
    });
    const byKey = new Map(rows.map((r) => [r.key, r]));
    return Object.fromEntries(
      CONFIG_REGISTRY.filter((d) => d.public).map((d) => {
        const row = byKey.get(d.key);
        return [
          d.key,
          row && d.validate(row.value) === null ? row.value : d.defaultValue,
        ];
      }),
    );
  }

  async listForAdmin() {
    const rows = await this.prisma.appConfig.findMany({
      orderBy: { key: 'asc' },
    });
    const byKey = new Map(rows.map((r) => [r.key, r]));
    const known = CONFIG_REGISTRY.map((d) => {
      const row = byKey.get(d.key);
      return {
        key: d.key,
        description: d.description,
        public: d.public,
        value: row ? row.value : d.defaultValue,
        isDefault: !row,
        valid: row ? d.validate(row.value) === null : true,
        version: row?.version ?? 0,
        updatedAt: row?.updatedAt ?? null,
        updatedById: row?.updatedById ?? null,
      };
    });
    // Rows that exist in the DB but aren't in the registry: shown (read-only) so they can
    // be cleaned up, never served to clients, never writable.
    const unknown = rows
      .filter((r) => !CONFIG_BY_KEY.has(r.key))
      .map((r) => ({
        key: r.key,
        value: r.value,
        version: r.version,
        updatedAt: r.updatedAt,
      }));
    return { keys: known, unknownKeys: unknown };
  }

  // expectedVersion = the version the editor saw (0 when the key has never been stored).
  async set(
    input: {
      key: string;
      value: unknown;
      expectedVersion: number;
      reason: string;
    },
    actor: AuditActor,
    ctx: AuditContext,
  ) {
    const def = CONFIG_BY_KEY.get(input.key);
    if (!def) {
      throw new BadRequestException({
        message: `"${input.key}" is not a configurable key`,
        code: 'UNKNOWN_CONFIG_KEY',
      });
    }
    const invalid = def.validate(input.value);
    if (invalid) {
      throw new BadRequestException({
        message: `${input.key} ${invalid}`,
        code: 'INVALID_CONFIG_VALUE',
      });
    }
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.appConfig.findUnique({
        where: { key: input.key },
      });
      const currentVersion = current?.version ?? 0;
      if (currentVersion !== input.expectedVersion) {
        throw new ConflictException({
          message:
            'This setting was changed by someone else — reload and try again',
          code: 'CONFIG_VERSION_CONFLICT',
          currentVersion,
        });
      }
      const value = input.value as Prisma.InputJsonValue;
      let saved: AppConfig;
      if (current) {
        const res = await tx.appConfig.updateMany({
          where: { key: input.key, version: currentVersion },
          data: {
            value,
            version: { increment: 1 },
            updatedById: actor.id ?? null,
          },
        });
        if (res.count !== 1) {
          throw new ConflictException({
            message: 'Setting changed concurrently',
            code: 'CONFIG_VERSION_CONFLICT',
          });
        }
        saved = await tx.appConfig.findUniqueOrThrow({
          where: { key: input.key },
        });
      } else {
        // Two concurrent first writes both see version 0; the PK makes the loser fail
        // with P2002 → 409 through the global filter.
        saved = await tx.appConfig.create({
          data: {
            key: input.key,
            value,
            version: 1,
            updatedById: actor.id ?? null,
          },
        });
      }
      await this.audit.record(tx, {
        category: 'admin_action',
        action: 'config.updated',
        actor,
        target: { type: 'config', id: input.key },
        reason: input.reason,
        before: current
          ? { value: current.value, version: current.version }
          : null,
        after: { value: saved.value, version: saved.version },
        ctx,
      });
      return saved;
    });
  }
}
