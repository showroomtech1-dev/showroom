import type { MigrationInterface, QueryRunner } from "typeorm";

export class Phase4Expenses1793750000004 implements MigrationInterface {
  name = "Phase4Expenses1793750000004";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "expense_categories" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "organization_id" uuid NOT NULL, "name" character varying(80) NOT NULL, "is_system" boolean NOT NULL DEFAULT false, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_d0ef31e189d9523461215b62775" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_expense_categories_org_name" ON "expense_categories" ("organization_id", "name") WHERE deleted_at IS NULL`);
    await queryRunner.query(`CREATE TABLE "expenses" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "organization_id" uuid NOT NULL, "branch_id" uuid NOT NULL, "code" character varying(24) NOT NULL, "expense_date" date NOT NULL, "category_id" uuid NOT NULL, "amount" bigint NOT NULL DEFAULT '0', "method" character varying(10) NOT NULL, "account_id" uuid NOT NULL, "payee" character varying(160), "supplier_id" uuid, "description" text, "receipt_url" character varying(500), "receipt_public_id" character varying(255), "recurring_expense_id" uuid, "client_ref" character varying(64), "created_by_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "CHK_expenses_amount" CHECK ("amount" > 0), CONSTRAINT "PK_94c3ceb17e3140abc9282c20610" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "IDX_expenses_org_date" ON "expenses" ("organization_id", "expense_date") `);
    await queryRunner.query(`CREATE INDEX "IDX_expenses_org_category_date" ON "expenses" ("organization_id", "category_id", "expense_date") `);
    await queryRunner.query(`CREATE INDEX "IDX_expenses_org_supplier" ON "expenses" ("organization_id", "supplier_id") `);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_expenses_org_code" ON "expenses" ("organization_id", "code") `);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_expenses_client_ref" ON "expenses" ("organization_id", "client_ref") WHERE client_ref IS NOT NULL`);
    await queryRunner.query(`CREATE TABLE "recurring_expenses" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "organization_id" uuid NOT NULL, "branch_id" uuid NOT NULL, "category_id" uuid NOT NULL, "name" character varying(120) NOT NULL, "amount" bigint NOT NULL DEFAULT '0', "method" character varying(10) NOT NULL DEFAULT 'transfer', "account_id" uuid, "payee" character varying(160), "supplier_id" uuid, "frequency" character varying(12) NOT NULL DEFAULT 'monthly', "start_date" date NOT NULL, "next_due_date" date NOT NULL, "end_date" date, "is_active" boolean NOT NULL DEFAULT true, "last_recorded_at" TIMESTAMP WITH TIME ZONE, "notes" text, "created_by_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "CHK_recurring_expenses_amount" CHECK ("amount" > 0), CONSTRAINT "PK_592b47923f3bdb6035439182e66" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "IDX_recurring_expenses_org_due" ON "recurring_expenses" ("organization_id", "is_active", "next_due_date") `);
    await queryRunner.query(`ALTER TABLE "expense_categories" ADD CONSTRAINT "FK_a713916d96f313cb62dd563df19" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "expenses" ADD CONSTRAINT "FK_47784468bc789a4e58fa64b4b3e" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "expenses" ADD CONSTRAINT "FK_5d1f4be708e0dfe2afa1a3c376c" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "expenses" ADD CONSTRAINT "FK_7d3a5c59d9c35ca6a4f059f122d" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "expenses" ADD CONSTRAINT "FK_a30707018a9722e9551db12ea8a" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "expenses" ADD CONSTRAINT "FK_8104aa9ff428fca40453dc0c6b5" FOREIGN KEY ("recurring_expense_id") REFERENCES "recurring_expenses"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "recurring_expenses" ADD CONSTRAINT "FK_22b5a6ee7e247e8538f992f9852" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "recurring_expenses" ADD CONSTRAINT "FK_6c283ae62cbde91625a20e9ccbd" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "recurring_expenses" DROP CONSTRAINT "FK_6c283ae62cbde91625a20e9ccbd"`);
    await queryRunner.query(`ALTER TABLE "recurring_expenses" DROP CONSTRAINT "FK_22b5a6ee7e247e8538f992f9852"`);
    await queryRunner.query(`ALTER TABLE "expenses" DROP CONSTRAINT "FK_8104aa9ff428fca40453dc0c6b5"`);
    await queryRunner.query(`ALTER TABLE "expenses" DROP CONSTRAINT "FK_a30707018a9722e9551db12ea8a"`);
    await queryRunner.query(`ALTER TABLE "expenses" DROP CONSTRAINT "FK_7d3a5c59d9c35ca6a4f059f122d"`);
    await queryRunner.query(`ALTER TABLE "expenses" DROP CONSTRAINT "FK_5d1f4be708e0dfe2afa1a3c376c"`);
    await queryRunner.query(`ALTER TABLE "expenses" DROP CONSTRAINT "FK_47784468bc789a4e58fa64b4b3e"`);
    await queryRunner.query(`ALTER TABLE "expense_categories" DROP CONSTRAINT "FK_a713916d96f313cb62dd563df19"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_recurring_expenses_org_due"`);
    await queryRunner.query(`DROP TABLE "recurring_expenses"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_expenses_client_ref"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_expenses_org_code"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_expenses_org_supplier"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_expenses_org_category_date"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_expenses_org_date"`);
    await queryRunner.query(`DROP TABLE "expenses"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_expense_categories_org_name"`);
    await queryRunner.query(`DROP TABLE "expense_categories"`);
  }
}
