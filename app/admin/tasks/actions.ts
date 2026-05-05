'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

const attendancePath = '/admin/tasks'

const toInt = (value: FormDataEntryValue | null) => {
    const parsed = Number(String(value || '').replace(/[^0-9]/g, ''))
    return Number.isFinite(parsed) ? parsed : 0
}

const toFloat = (value: FormDataEntryValue | null) => {
    const parsed = Number(String(value || '').replace(/[^0-9.]/g, ''))
    return Number.isFinite(parsed) ? parsed : 0
}

const normalizeWorkDate = (value: string) => {
    const [year, month, day] = value.split('-').map(Number)
    if (!year || !month || !day) throw new Error('Invalid work date')
    return new Date(Date.UTC(year, month - 1, day))
}

export async function createEmployee(formData: FormData) {
    const name = String(formData.get('name') || '').trim()
    const hourlyWage = toInt(formData.get('hourlyWage'))
    const dailyHours = toFloat(formData.get('dailyHours'))

    if (!name) return { error: '직원 이름을 입력해 주세요.' }
    if (hourlyWage <= 0) return { error: '시급을 1원 이상 입력해 주세요.' }
    if (dailyHours <= 0) return { error: '1일근로시간을 0보다 크게 입력해 주세요.' }

    try {
        const employee = await prisma.attendanceEmployee.create({
            data: { name, hourlyWage, dailyHours }
        })
        revalidatePath(attendancePath)
        return {
            success: true,
            employee: {
                id: employee.id,
                name: employee.name,
                hourlyWage: employee.hourlyWage,
                dailyHours: employee.dailyHours,
                active: employee.active,
                records: []
            }
        }
    } catch (error) {
        console.error(error)
        return { error: '직원 추가에 실패했습니다.' }
    }
}

export async function updateEmployee(id: string, formData: FormData) {
    const name = String(formData.get('name') || '').trim()
    const hourlyWage = toInt(formData.get('hourlyWage'))
    const dailyHours = toFloat(formData.get('dailyHours'))

    if (!name) return { error: '직원 이름을 입력해 주세요.' }
    if (hourlyWage <= 0) return { error: '시급을 1원 이상 입력해 주세요.' }
    if (dailyHours <= 0) return { error: '1일근로시간을 0보다 크게 입력해 주세요.' }

    try {
        await prisma.attendanceEmployee.update({
            where: { id },
            data: { name, hourlyWage, dailyHours }
        })
        revalidatePath(attendancePath)
        return { success: true }
    } catch (error) {
        console.error(error)
        return { error: '직원 수정에 실패했습니다.' }
    }
}

export async function deleteEmployee(id: string) {
    try {
        await prisma.attendanceEmployee.delete({ where: { id } })
        revalidatePath(attendancePath)
        return { success: true }
    } catch (error) {
        console.error(error)
        return { error: '직원 삭제에 실패했습니다.' }
    }
}

export async function toggleAttendanceDate(employeeId: string, date: string) {
    try {
        const workDate = normalizeWorkDate(date)
        const existing = await prisma.attendanceRecord.findUnique({
            where: {
                employeeId_workDate: {
                    employeeId,
                    workDate
                }
            }
        })

        if (existing) {
            await prisma.attendanceRecord.delete({ where: { id: existing.id } })
        } else {
            await prisma.attendanceRecord.create({
                data: { employeeId, workDate }
            })
        }

        revalidatePath(attendancePath)
        return { success: true }
    } catch (error) {
        console.error(error)
        return { error: '근무일 저장에 실패했습니다.' }
    }
}

export async function createTask(formData: FormData) {
    const title = String(formData.get('title') || '').trim()
    const description = String(formData.get('description') || '').trim()
    const fileUrl = String(formData.get('fileUrl') || '').trim()
    const dateStr = String(formData.get('date') || new Date().toISOString())

    if (!title) return { error: 'Missing title' }

    try {
        await prisma.task.create({
            data: {
                title,
                description: description || null,
                fileUrl: fileUrl || null,
                date: new Date(dateStr),
                completed: false
            }
        })
        revalidatePath('/admin')
        return { success: true }
    } catch (error) {
        console.error(error)
        return { error: 'Failed to create task' }
    }
}

export async function updateTask(id: string, formData: FormData) {
    const title = String(formData.get('title') || '').trim()
    const description = String(formData.get('description') || '').trim()
    const fileUrl = String(formData.get('fileUrl') || '').trim()

    try {
        await prisma.task.update({
            where: { id },
            data: {
                title,
                description: description || null,
                fileUrl: fileUrl || undefined
            }
        })
        revalidatePath('/admin')
        return { success: true }
    } catch (error) {
        console.error(error)
        return { error: 'Failed to update task' }
    }
}

export async function toggleTask(id: string, completed: boolean) {
    try {
        await prisma.task.update({
            where: { id },
            data: { completed }
        })
        revalidatePath('/admin')
        return { success: true }
    } catch (error) {
        console.error(error)
        return { error: 'Failed to update task' }
    }
}

export async function deleteTask(id: string) {
    try {
        await prisma.task.delete({ where: { id } })
        revalidatePath('/admin')
        return { success: true }
    } catch (error) {
        console.error(error)
        return { error: 'Failed to delete task' }
    }
}

export async function updateTaskDate(id: string, newDate: string) {
    try {
        await prisma.task.update({
            where: { id },
            data: { date: new Date(newDate) }
        })
        revalidatePath('/admin')
        return { success: true }
    } catch (error) {
        console.error(error)
        return { error: 'Failed to update task date' }
    }
}
