import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                username: { label: "Username", type: "text" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                if (!credentials?.username || !credentials?.password) {
                    return null
                }

                try {
                    const user = await prisma.user.findUnique({
                        where: { username: credentials.username }
                    }) as any

                    if (!user) {
                        return null
                    }

                    const isPasswordValid = await bcrypt.compare(
                        credentials.password,
                        user.password
                    )

                    if (!isPasswordValid) {
                        return null
                    }

                    if (user.status !== 'APPROVED' && user.role !== 'ADMIN') {
                        throw new Error(`PENDING_APPROVAL_${user.country || 'UNKNOWN'}`)
                    }

                    return {
                        id: user.id,
                        name: user.name,
                        email: user.username,
                        role: user.role,
                        country: user.country,
                    }
                } catch (error: any) {
                    if (error.message?.startsWith('PENDING_APPROVAL')) {
                        throw error;
                    }

                    console.error("Database error during authentication:", error)
                    return null
                }
            }
        })
    ],
    callbacks: {
        async session({ session, token }) {
            if (token && session.user) {
                session.user.role = token.role as string
                session.user.id = token.id as string
                session.user.country = token.country as string
            }
            return session
        },
        async jwt({ token, user }) {
            if (user) {
                token.role = user.role
                token.id = user.id
                token.country = user.country
            }
            return token
        }
    },
    pages: {
        signIn: "/login",
    },
    session: {
        strategy: "jwt",
    },
    secret: process.env.NEXTAUTH_SECRET,
}
