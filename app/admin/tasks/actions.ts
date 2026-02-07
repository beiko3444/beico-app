'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function createTask(formData: FormData) {
    const title = formData.get('title') as string
    const description = formData.get('description') as string
    const fileUrl = formData.get('fileUrl') as string
    let dateStr = formData.get('date') as string

    console.log('Creating task:', { title, description, fileUrl, dateStr })

    if (!title) return { error: 'Missing title' }

    if (!dateStr) {
        dateStr = new Date().toISOString()
    }

    const taskDate = new Date(dateStr)
    if (isNaN(taskDate.getTime())) {
        return { error: `Invalid date: ${dateStr}` }
    }

    try {
        await prisma.task.create({
            data: {
                title,
                description: description || null,
                fileUrl: fileUrl || null,
                date: taskDate,
                completed: false
            }
        })
        revalidatePath('/admin/tasks')
        revalidatePath('/admin')
        return { success: true }
    } catch (e: any) {
        console.error(e)
        return { error: `Failed to create task: ${e.message}` }
    }
}

export async function updateTask(id: string, formData: FormData) {
    const title = formData.get('title') as string
    const description = formData.get('description') as string
    const fileUrl = formData.get('fileUrl') as string

    try {
        await prisma.task.update({
            where: { id },
            data: {
                title,
                description: description || null,
                fileUrl: fileUrl || undefined // Don't overwrite if not provided
            }
        })
        revalidatePath('/admin/tasks')
        revalidatePath('/admin')
        return { success: true }
    } catch (e: any) {
        console.error(e)
        return { error: `Failed to update task: ${e.message}` }
    }
}

export async function toggleTask(id: string, completed: boolean) {
    try {
        await prisma.task.update({
            where: { id },
            data: { completed }
        })
        revalidatePath('/admin/tasks')
        revalidatePath('/admin')
        return { success: true }
    } catch (e) {
        return { error: 'Failed to update task' }
    }
}

export async function deleteTask(id: string) {
    try {
        await prisma.task.delete({
            where: { id }
        })
        revalidatePath('/admin/tasks')
        revalidatePath('/admin')
        return { success: true }
    } catch (e) {
        return { error: 'Failed to delete task' }
    }
}

export async function updateTaskDate(id: string, newDate: string) {
    try {
        await prisma.task.update({
            where: { id },
            data: { date: new Date(newDate) }
        })
        revalidatePath('/admin/tasks')
        revalidatePath('/admin')
        return { success: true }
    } catch (e: any) {
        console.error(e)
        return { error: `Failed to update task date: ${e.message}` }
    }
}
