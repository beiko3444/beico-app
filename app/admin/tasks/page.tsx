import { prisma } from '@/lib/prisma'
import TasksClient from './TasksClient'

export const dynamic = 'force-dynamic'

export default async function TasksPage() {
    const employees = await prisma.attendanceEmployee.findMany({
        orderBy: [{ active: 'desc' }, { createdAt: 'asc' }],
        include: {
            records: {
                orderBy: { workDate: 'asc' }
            }
        }
    })

    return <TasksClient initialEmployees={employees} />
}
