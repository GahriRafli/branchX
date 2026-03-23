const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('password123', 12);
  const admin = await prisma.user.upsert({
    where: { nip: '12345' },
    update: {},
    create: {
      nip: '12345',
      name: 'Admin User',
      password: hashedPassword,
      role: 'ADMIN',
      can_access_monitoring: true,
    },
  });

  // Sample Monitoring Data
  await prisma.monitoringGMM.createMany({
    data: [
      { name: 'Produk A', codeReferral: 'REF001', product: 'GMM Standard', amount: 150, target: 200, total: 150 },
      { name: 'Produk B', codeReferral: 'REF002', product: 'GMM Premium', amount: 80, target: 100, total: 80 },
      { name: 'Produk C', codeReferral: 'REF003', product: 'GMM basic', amount: 300, target: 250, total: 300 },
    ],
  });

  console.log('Seed successful:', admin);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
