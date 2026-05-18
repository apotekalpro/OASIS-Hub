'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff } from 'lucide-react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { signIn } from '@/lib/auth/actions'

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting }, getValues } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setError(null)
    const result = await signIn(data.email, data.password)
    if (!result.success) {
      setError(result.error || 'Login failed. Please check your credentials.')
      return
    }
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-blue-950 flex items-center justify-center p-4">
      {/* Background decorative circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 inline-block">
              <Image
                src="/alpro-logo.jpg"
                alt="Alpro Pharmacy"
                width={140}
                height={56}
                className="h-14 w-auto object-contain"
                priority
              />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">OASIS Hub</h1>
          <p className="text-indigo-300 text-sm mt-1.5">Internal Management System</p>
        </div>

        {/* Card */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-6">Sign in to your account</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-indigo-200 mb-1.5">
                Email address
              </label>
              <Input
                type="email"
                placeholder="you@company.com"
                error={errors.email?.message}
                className="bg-white/10 border-white/20 text-white placeholder:text-indigo-300 focus:border-indigo-400 focus:ring-indigo-400"
                {...register('email')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-indigo-200 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  className="pr-10 bg-white/10 border-white/20 text-white placeholder:text-indigo-300 focus:border-indigo-400 focus:ring-indigo-400"
                  error={errors.password?.message}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit(onSubmit)() } }}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2 text-indigo-300 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-400/30 rounded-lg px-4 py-3">
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}

            <Button type="submit" className="w-full bg-indigo-500 hover:bg-indigo-400 text-white border-0" size="lg" loading={isSubmitting}>
              Sign In
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-indigo-400">
            Don't have an account? Contact your system administrator.
          </p>
        </div>
      </div>
    </div>
  )
}
