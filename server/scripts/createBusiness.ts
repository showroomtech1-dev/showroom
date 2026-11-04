// Creates a real business (no demo data) and its owner login.
//   npm run create-business -- --name "My Showroom" --owner "Ada Obi" --email ada@example.com --password "Secret123"
import "reflect-metadata";
import { AppDataSource } from "../infrastructure/database/dataSource";
import { OnboardingService } from "../modules/organization/services/onboarding.service";
import { PASSWORD_RULE } from "../shared/utils/password";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const businessName = arg("name");
  const ownerName = arg("owner");
  const ownerEmail = arg("email");
  const ownerPassword = arg("password");
  if (!businessName || !ownerName || !ownerEmail || !ownerPassword) {
    console.error('Usage: npm run create-business -- --name "Business" --owner "Owner Name" --email owner@example.com --password "Secret123" [--phone 080…] [--address "…"]');
    process.exit(1);
  }
  if (!PASSWORD_RULE.test(ownerPassword)) {
    console.error("The password must be 8–72 characters and include a letter and a number.");
    process.exit(1);
  }
  await AppDataSource.initialize();
  try {
    const created = await OnboardingService.Instance.createBusiness({ businessName, ownerName, ownerEmail, ownerPassword, phone: arg("phone"), address: arg("address") });
    console.log(`Created "${businessName}". Sign in as ${ownerEmail}. (organization ${created.organizationId})`);
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
