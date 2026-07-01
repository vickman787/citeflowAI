import { login, signup } from './actions'
import Image from 'next/image'
import Link from 'next/link'
import logoImage from '../../../../public/logo.jpg'

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center p-4 content-container">
      <div className="w-full max-w-md card-panel p-8 sm:p-10">
        <div className="flex flex-col items-center mb-8">
          <Link href="/" className="mb-4">
            <Image src={logoImage} alt="CiteFlowAI Logo" width={48} height={48} className="rounded" />
          </Link>
          <h1 className="text-2xl font-serif font-bold text-[var(--color-ink)]">CiteFlowAI</h1>
          <p className="text-[var(--color-soft-ink)] text-sm mt-2 font-mono uppercase tracking-widest">Authentication</p>
        </div>
        <form className="flex flex-col space-y-6">
          <div>
            <label htmlFor="email" className="label-text">Email</label>
            <input 
              id="email" 
              name="email" 
              type="email" 
              required 
              className="input-field"
            />
          </div>
          <div>
            <label htmlFor="password" className="label-text">Password</label>
            <input 
              id="password" 
              name="password" 
              type="password" 
              required 
              className="input-field"
            />
          </div>
          <div className="flex flex-col space-y-4 pt-4 border-t border-[var(--color-border-subtle)]">
            <button 
              formAction={login} 
              className="btn btn-primary w-full"
            >
              Log In
            </button>
            <button 
              formAction={signup} 
              className="btn btn-secondary w-full"
            >
              Create Account
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
