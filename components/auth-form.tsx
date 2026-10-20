'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn, signUp } from '@/lib/auth-client'

export default function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const isSignUp = mode === 'sign-up'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setPending(true)
    const result = isSignUp ? await signUp.email({ name, email, password }) : await signIn.email({ email, password })
    setPending(false)
    if (result.error) {
      setError('Email atau kata sandi tidak valid. Silakan coba lagi.')
      return
    }
    router.push('/')
    router.refresh()
  }

  return <main className="auth-page"><div className="auth-card"><div className="auth-brand"><div className="brand-mark">P</div><div><strong>PALOS</strong><span>Portal Dokumen</span></div></div><h1>{isSignUp ? 'Buat akun baru' : 'Selamat datang kembali'}</h1><p>{isSignUp ? 'Daftarkan akun untuk mulai mengelola dokumen perusahaan.' : 'Masuk untuk melanjutkan ke portal dokumen perusahaan.'}</p><form onSubmit={handleSubmit} className="auth-form">{isSignUp && <label>Nama lengkap<input required value={name} onChange={(event) => setName(event.target.value)} /></label>}<label>Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Kata sandi<input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error && <p className="auth-error">{error}</p>}<button className="primary-button" disabled={pending}>{pending ? 'Memproses...' : isSignUp ? 'Buat akun' : 'Masuk'}</button></form><p className="auth-switch">{isSignUp ? 'Sudah punya akun?' : 'Belum punya akun?'} <a href={isSignUp ? '/sign-in' : '/sign-up'}>{isSignUp ? 'Masuk' : 'Daftar sekarang'}</a></p></div></main>
}
