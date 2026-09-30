import { execSync } from "child_process";
import { rmSync } from "fs";
import path from "path";
import { E2E } from "./env";

// Brings the disposable test database to the committed migrations and seeds exactly what
// the smoke test needs: one admin account (no authenticator yet — the test enrolls it) and
// one pending listing to review. Uses apps/api's Prisma client; never touches dev/prod
// (env.ts refuses non-local hosts).
export default async function globalSetup() {
  const apiDir = path.join(__dirname, "..", "..", "api");
  execSync("npx prisma migrate deploy", {
    cwd: apiDir,
    env: { ...process.env, DATABASE_URL: E2E.dbUrl, DIRECT_URL: E2E.dbUrl },
    stdio: "pipe"
  });
  rmSync(E2E.smsSinkDir, { recursive: true, force: true });

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaClient } = require(require.resolve("@prisma/client", { paths: [apiDir] }));
  const prisma = new PrismaClient({ datasources: { db: { url: E2E.dbUrl } } });
  try {
    const tables: { tablename: string }[] = await prisma.$queryRaw`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
    await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"public"."${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);

    const admin = await prisma.profile.create({
      data: { phone: E2E.adminPhone, phoneVerified: true, fullName: "Playwright Admin", role: "admin" }
    });
    await prisma.adminUser.create({ data: { profileId: admin.id, role: "admin" } });

    const owner = await prisma.profile.create({
      data: { phone: "+919900000556", phoneVerified: true, fullName: "Playwright Owner", role: "owner" }
    });
    const now = Date.now();
    await prisma.listing.create({
      data: {
        ownerId: owner.id,
        title: E2E.listingTitle,
        description: "Seeded by the admin console browser test.",
        propertyType: "room",
        rent: 7200,
        locality: "Jalukbari",
        status: "pending",
        submittedAt: new Date(now),
        autoApproveAt: new Date(now + 5 * 60_000),
        images: {
          create: [0, 1, 2].map((i) => ({
            cloudinaryUrl: `https://res.cloudinary.com/ghortest/image/upload/v1/ghor/listings/e2e-${i}.jpg`,
            position: i
          }))
        }
      }
    });
  } finally {
    await prisma.$disconnect();
  }
}
