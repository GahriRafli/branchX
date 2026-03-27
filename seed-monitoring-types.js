
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const types = [
    {
      name: 'GMM',
      icon: '📊',
      fields: [
        { label: 'NO ACCOUNT', key: 'noAccount', type: 'text', required: true, isArray: true },
        { label: 'PRODUK', key: 'product', type: 'text', required: true }
      ]
    },
    {
      name: 'KSM',
      icon: '🏥',
      fields: [
        { label: 'BOOKING ID', key: 'bookingId', type: 'text', required: true, isArray: true }
      ]
    },
    {
      name: 'KPR',
      icon: '🏠',
      fields: [
        { label: 'BOOKING ID', key: 'bookingId', type: 'text', required: true, isArray: true }
      ]
    },
    {
      name: 'CC',
      icon: '💳',
      fields: [
        { label: 'NO ACCOUNT', key: 'noAccount', type: 'text', required: true, isArray: true },
        { label: 'PRODUK', key: 'product', type: 'text', required: true }
      ]
    }
  ];

  for (const t of types) {
    await prisma.monitoringActivityType.upsert({
      where: { name: t.name },
      update: { icon: t.icon, fields: t.fields },
      create: t
    });
  }
  console.log('Seeded initial monitoring activity types.');
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => await prisma.$disconnect())
