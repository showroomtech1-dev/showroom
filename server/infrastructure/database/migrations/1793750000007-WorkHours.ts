import type { MigrationInterface, QueryRunner } from "typeorm";

export class WorkHours1793750000007 implements MigrationInterface {
  name = "WorkHours1793750000007";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "organization_settings" ADD "work_end_time" character varying(5) NOT NULL DEFAULT '17:30'`);
    await queryRunner.query(`ALTER TABLE "organization_settings" ADD "late_deduction_enabled" boolean NOT NULL DEFAULT true`);
    await queryRunner.query(`ALTER TABLE "attendance" ADD "minutes_early" integer NOT NULL DEFAULT '0'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "attendance" DROP COLUMN "minutes_early"`);
    await queryRunner.query(`ALTER TABLE "organization_settings" DROP COLUMN "late_deduction_enabled"`);
    await queryRunner.query(`ALTER TABLE "organization_settings" DROP COLUMN "work_end_time"`);
  }
}
