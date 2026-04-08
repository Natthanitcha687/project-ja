import { prisma } from "../src/db/prisma.js";

async function main() {
  console.log("Scanning for placeholder serials (pattern: SN###)...");

  // Find warranty items whose serial is exactly SN followed by 3 digits (e.g. SN001)
  const rows = await prisma.$queryRaw`
    SELECT id, serial FROM "WarrantyItem" WHERE serial ~ '^SN[0-9]{3}$'
  `;

  if (!rows || rows.length === 0) {
    console.log("No placeholder serials found.");
    return;
  }

  console.log(`Found ${rows.length} items. Preparing to clear serials (set to NULL)...`);
  const ids = rows.map((r) => r.id);

  const result = await prisma.warrantyItem.updateMany({
    where: { id: { in: ids } },
    data: { serial: null },
  });

  console.log(`Updated ${result.count} warranty items (serial set to NULL).`);
}

main()
  .catch((e) => {
    console.error("Error while fixing placeholder serials:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
