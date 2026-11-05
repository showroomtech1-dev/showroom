import type { MigrationInterface, QueryRunner } from "typeorm";

export class Phase6Email1793750000006 implements MigrationInterface {
  name = "Phase6Email1793750000006";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "password_resets" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "code_hash" character varying(64) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "used_at" TIMESTAMP WITH TIME ZONE, "attempts" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_4816377aa98211c1de34469e742" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "IDX_password_resets_user" ON "password_resets" ("user_id", "created_at") `);
    await queryRunner.query(`ALTER TABLE "organization_settings" ADD "email_digest_enabled" boolean NOT NULL DEFAULT true`);
    await queryRunner.query(`ALTER TABLE "organization_settings" ADD "email_digest_hour" integer NOT NULL DEFAULT '7'`);
    await queryRunner.query(`ALTER TABLE "organization_settings" ADD "email_alerts_enabled" boolean NOT NULL DEFAULT true`);
    await queryRunner.query(`ALTER TABLE "organization_settings" ADD "email_receipts_enabled" boolean NOT NULL DEFAULT true`);
    await queryRunner.query(`ALTER TABLE "organization_settings" ADD "email_debt_reminders_auto" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "organization_settings" ADD "email_payslips_enabled" boolean NOT NULL DEFAULT true`);
    await queryRunner.query(`ALTER TABLE "organization_settings" ADD "last_digest_date" date`);
    await queryRunner.query(`ALTER TABLE "password_resets" ADD CONSTRAINT "FK_f7a4c3bc48f24df007936d217be" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "password_resets" DROP CONSTRAINT "FK_f7a4c3bc48f24df007936d217be"`);
    await queryRunner.query(`ALTER TABLE "organization_settings" DROP COLUMN "last_digest_date"`);
    await queryRunner.query(`ALTER TABLE "organization_settings" DROP COLUMN "email_payslips_enabled"`);
    await queryRunner.query(`ALTER TABLE "organization_settings" DROP COLUMN "email_debt_reminders_auto"`);
    await queryRunner.query(`ALTER TABLE "organization_settings" DROP COLUMN "email_receipts_enabled"`);
    await queryRunner.query(`ALTER TABLE "organization_settings" DROP COLUMN "email_alerts_enabled"`);
    await queryRunner.query(`ALTER TABLE "organization_settings" DROP COLUMN "email_digest_hour"`);
    await queryRunner.query(`ALTER TABLE "organization_settings" DROP COLUMN "email_digest_enabled"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_password_resets_user"`);
    await queryRunner.query(`DROP TABLE "password_resets"`);
  }
}
