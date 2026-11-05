import type { MigrationInterface, QueryRunner } from "typeorm";

/** Last time a user was seen using the app (API call or live connection) — for the platform admin view. */
export class UserLastSeen1793750000008 implements MigrationInterface {
  name = "UserLastSeen1793750000008";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "last_seen_at" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`UPDATE "users" SET "last_seen_at" = "last_login_at" WHERE "last_login_at" IS NOT NULL`);
    await queryRunner.query(`CREATE INDEX "IDX_users_created" ON "users" ("created_at") `);
    await queryRunner.query(`CREATE INDEX "IDX_organizations_created" ON "organizations" ("created_at") `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_organizations_created"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_users_created"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "last_seen_at"`);
  }
}
