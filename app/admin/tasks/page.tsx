
import { prisma } from '@/lib/prisma'
import { unstable_cache } from 'next/cache'
import TasksClient from './TasksClient'

export const dynamic = 'force-dynamic'

const getCachedTasks = unstable_cache(
    async () => prisma.task.findMany({
        orderBy: { date: 'asc' }
    }),
    ['admin-tasks-page-v1'],
    { revalidate: 5 }
)

export default async function TasksPage() {
    const tasks = await getCachedTasks()

    return <TasksClient initialTasks={tasks} />
}
