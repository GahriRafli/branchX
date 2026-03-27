
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const result = await prisma.monitoringActivity.updateMany({
    where: {
      OR: [
        { amount: 0 },
        { target: 0 },
        { total: 0 }
      ]
    },
    data: {
      amount: 1,
      target: 1,
      total: 1
    }
  })
  console.log(`Updated ${result.count} records to default 1.`)
}

main()
  .catch(e => {
    console.error('Error fixing zeros:', e)
    process.exit(1)
  })
  .finally(async () => await prisma.$disconnect())
