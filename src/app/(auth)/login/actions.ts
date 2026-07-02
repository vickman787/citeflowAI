'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    const errMessage = error.message && error.message !== '{}' 
      ? error.message 
      : ((error as any).error_description || "Invalid login credentials. Please try again.");
    redirect(`/login?error=${encodeURIComponent(errMessage)}`)
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signUp({
    email,
    password,
  })

  if (error) {
    const errMessage = error.message && error.message !== '{}' 
      ? error.message 
      : ((error as any).error_description || "An error occurred during sign up. Please try again or use a different email.");
    redirect(`/login?error=${encodeURIComponent(errMessage)}`)
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}
