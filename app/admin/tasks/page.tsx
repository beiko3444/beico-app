
import { prisma } from '@/lib/prisma'
import TasksClient from './TasksClient'

export default async function TasksPage() {
    // Fetch all tasks or filter by current month usage
    const tasks = await prisma.task.findMany({
        orderBy: { date: 'asc' }
    })

    return <TasksClient initialTasks={tasks} />
}
