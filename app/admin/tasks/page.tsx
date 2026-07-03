import { prisma } from '@/lib/prisma'
import TasksClient from './TasksClient'

export const dynamic = 'force-dynamic'

export default async function TasksPage() {
    const [employees, tasks] = await Promise.all([
        prisma.attendanceEmployee.findMany({
            orderBy: [{ active: 'desc' }, { createdAt: 'asc' }],
            include: {
                records: {
                    orderBy: { workDate: 'asc' }
                }
            }
        }),
        prisma.task.findMany({
            orderBy: { date: 'asc' }
        })
    ])

    return <TasksClient initialEmployees={employees} initialTasks={tasks} />
}
